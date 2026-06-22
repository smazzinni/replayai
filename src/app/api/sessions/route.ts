import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapSession, mapSessionSummary } from "@/lib/mappers";
import { broadcast } from "@/lib/notify";
import { getAuthHeader, unauthorized, validateAuth } from "@/lib/auth";
import {
  clampInt,
  estimateCost,
  isNonEmpty,
  sanitizeStepText,
  VALID_ORDER_BY,
  VALID_SESSION_STATUSES,
  VALID_STEP_STATUSES,
  VALID_STEP_TYPES,
} from "@/lib/session-ingest";

export const dynamic = "force-dynamic";

/**
 * GET /api/sessions?projectId=&status=&q=&limit=&offset=&orderBy=&withSteps=
 *
 * List sessions with filtering, sorting, and pagination. Returns summary
 * objects (no step payloads) by default — pass `?withSteps=1` to include the
 * full step list for each session.
 */
export async function GET(req: NextRequest) {
  const auth = await validateAuth(getAuthHeader(req));
  if (!auth.ok) return unauthorized(auth.error);

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") || undefined;
  const statusParam = searchParams.get("status") || undefined;
  const q = searchParams.get("q")?.trim() || undefined;
  const limit = clampInt(searchParams.get("limit"), 100, 1, 200);
  const offset = clampInt(searchParams.get("offset"), 0, 0, 100_000);
  const orderByParam = searchParams.get("orderBy") || "startedAt";
  const orderBy = VALID_ORDER_BY.includes(
    orderByParam as (typeof VALID_ORDER_BY)[number],
  )
    ? (orderByParam as (typeof VALID_ORDER_BY)[number])
    : "startedAt";
  const withSteps = searchParams.get("withSteps") === "1";

  const status =
    statusParam &&
    VALID_SESSION_STATUSES.includes(
      statusParam as (typeof VALID_SESSION_STATUSES)[number],
    )
      ? (statusParam as (typeof VALID_SESSION_STATUSES)[number])
      : undefined;

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { agent: { contains: q } },
      { tags: { contains: q } },
    ];
  }

  const order = { [orderBy]: "desc" as const };

  const [sessions, total] = await Promise.all([
    db.session.findMany({
      where,
      orderBy: order,
      take: limit,
      skip: offset,
      include: withSteps
        ? { steps: { orderBy: { order: "asc" } } }
        : { _count: { select: { steps: true } } },
    }),
    db.session.count({ where }),
  ]);

  return NextResponse.json({
    sessions: withSteps
      ? sessions.map((s) => mapSession(s as never))
      : sessions.map((s) => mapSessionSummary(s as never)),
    total,
    limit,
    offset,
    // Pagination hint for clients: is there another page?
    hasMore: offset + sessions.length < total,
  });
}

/**
 * POST /api/sessions — ingest a recorded session from the SDK.
 *
 * Body shape matches what `replayai.trace()` flushes at the end of a run.
 * Validates input, resolves the project, derives missing totals, and
 * broadcasts a `session:created` event to connected dashboards.
 */
export async function POST(req: NextRequest) {
  const auth = await validateAuth(getAuthHeader(req));
  if (!auth.ok) return unauthorized(auth.error);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ---- Validate required + derived fields -----------------------------------
  const name = isNonEmpty(body.name)
    ? body.name.trim().slice(0, 300)
    : `Session ${new Date().toISOString()}`;
  const agent = isNonEmpty(body.agent)
    ? body.agent.trim().slice(0, 200)
    : "unknown-agent";
  const framework = isNonEmpty(body.framework)
    ? body.framework.trim().slice(0, 100)
    : "Custom";

  const statusRaw = typeof body.status === "string" ? body.status : undefined;
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((t): t is string => typeof t === "string").slice(0, 20)
    : [];

  const stepsRaw = Array.isArray(body.steps) ? body.steps : [];
  // Validate + sanitize each step; skip malformed entries.
  const steps = stepsRaw
    .filter((s): s is Record<string, unknown> => s !== null && typeof s === "object")
    .map((s) => ({
      type:
        typeof s.type === "string" && VALID_STEP_TYPES.includes(s.type as never)
          ? (s.type as (typeof VALID_STEP_TYPES)[number])
          : "llm_call",
      name: isNonEmpty(s.name) ? s.name.trim().slice(0, 300) : "unnamed step",
      offsetMs: clampInt(s.offsetMs ?? s.t, 0, 0, 86_400_000),
      durationMs: clampInt(s.durationMs, 0, 0, 86_400_000),
      status:
        typeof s.status === "string" &&
        VALID_STEP_STATUSES.includes(s.status as never)
          ? (s.status as (typeof VALID_STEP_STATUSES)[number])
          : "success",
      model: typeof s.model === "string" && s.model ? s.model.slice(0, 100) : null,
      tokensIn: clampInt(s.tokensIn, 0, 0, 100_000_000),
      tokensOut: clampInt(s.tokensOut, 0, 0, 100_000_000),
      input: sanitizeStepText(s.input),
      output: sanitizeStepText(s.output),
    }));

  // ---- Resolve project ------------------------------------------------------
  let projectId =
    typeof body.projectId === "string" ? body.projectId : undefined;
  if (!projectId && typeof body.projectSlug === "string") {
    const p = await db.project.findUnique({
      where: { slug: body.projectSlug },
    });
    projectId = p?.id;
  }
  if (!projectId) {
    // Fall back to the first project (default workspace).
    const first = await db.project.findFirst({ orderBy: { createdAt: "asc" } });
    projectId = first?.id;
  }
  if (!projectId) {
    return NextResponse.json(
      { error: "No project found. Create a project first via POST /api/projects." },
      { status: 400 },
    );
  }

  // ---- Derive totals if the SDK omitted them --------------------------------
  const tokenTotal =
    typeof body.tokenTotal === "number" && Number.isFinite(body.tokenTotal)
      ? body.tokenTotal
      : steps.reduce((a, s) => a + s.tokensIn + s.tokensOut, 0);
  const costUsd =
    typeof body.costUsd === "number" && Number.isFinite(body.costUsd)
      ? body.costUsd
      : estimateCost(steps);
  const durationMs =
    typeof body.durationMs === "number" && Number.isFinite(body.durationMs)
      ? body.durationMs
      : steps.reduce(
          (a, s) => Math.max(a, s.offsetMs + s.durationMs),
          0,
        );
  const status =
    statusRaw && VALID_SESSION_STATUSES.includes(statusRaw as never)
      ? (statusRaw as (typeof VALID_SESSION_STATUSES)[number])
      : steps.some((s) => s.status === "failed")
        ? "failed"
        : steps.length > 0
          ? "success"
          : "running";

  const startedAt = body.startedAt
    ? new Date(body.startedAt as string)
    : new Date();
  if (Number.isNaN(startedAt.getTime())) {
    return NextResponse.json(
      { error: "Invalid startedAt — expected an ISO 8601 timestamp." },
      { status: 400 },
    );
  }

  // ---- Persist (session + steps in one transaction) -------------------------
  const session = await db.session.create({
    data: {
      projectId,
      name,
      agent,
      framework,
      status,
      startedAt,
      durationMs,
      tokenTotal,
      costUsd,
      tags: tags.join(","),
    },
  });

  if (steps.length > 0) {
    await db.step.createMany({
      data: steps.map((st, i) => ({
        sessionId: session.id,
        order: i,
        type: st.type,
        name: st.name,
        offsetMs: st.offsetMs,
        durationMs: st.durationMs,
        status: st.status,
        model: st.model,
        tokensIn: st.tokensIn,
        tokensOut: st.tokensOut,
        input: st.input,
        output: st.output,
      })),
    });
  }

  const full = await db.session.findUnique({
    where: { id: session.id },
    include: { steps: { orderBy: { order: "asc" } }, project: true },
  });

  const mapped = mapSession(full!);
  void broadcast("session:created", { session: mapped });

  return NextResponse.json({ session: mapped }, { status: 201 });
}
