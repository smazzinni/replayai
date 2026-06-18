import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapSession, mapSessionSummary } from "@/lib/mappers";
import { broadcast } from "@/lib/notify";
import { getAuthHeader, unauthorized, validateAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/sessions?projectId=&status=&q=&limit=&offset=&orderBy=
 * List sessions (without steps by default; add ?withSteps=1 to include).
 */
export async function GET(req: NextRequest) {
  const auth = await validateAuth(getAuthHeader(req));
  if (!auth.ok) return unauthorized(auth.error);

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const status = searchParams.get("status"); // success | failed | running
  const q = searchParams.get("q")?.trim();
  const limit = Math.min(
    200,
    Math.max(1, Number(searchParams.get("limit") ?? "100")),
  );
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0"));
  const orderBy = searchParams.get("orderBy") ?? "startedAt";
  const withSteps = searchParams.get("withSteps") === "1";

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (status === "success" || status === "failed" || status === "running") {
    where.status = status;
  }
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { agent: { contains: q } },
      { tags: { contains: q } },
    ];
  }

  const order =
    orderBy === "durationMs"
      ? { durationMs: "desc" as const }
      : orderBy === "costUsd"
        ? { costUsd: "desc" as const }
        : orderBy === "tokenTotal"
          ? { tokenTotal: "desc" as const }
          : { startedAt: "desc" as const };

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
  });
}

/**
 * POST /api/sessions — ingest a recorded session from the SDK.
 * Body shape matches what `replayai.trace()` flushes at the end of a run.
 */
export async function POST(req: NextRequest) {
  const auth = await validateAuth(getAuthHeader(req));
  if (!auth.ok) return unauthorized(auth.error);

  let body: {
    projectId?: string;
    projectSlug?: string;
    name?: string;
    agent?: string;
    framework?: string;
    status?: string;
    startedAt?: string;
    durationMs?: number;
    tokenTotal?: number;
    costUsd?: number;
    tags?: string[];
    steps?: Array<{
      type?: string;
      name?: string;
      t?: number;
      offsetMs?: number;
      durationMs?: number;
      status?: string;
      model?: string;
      tokensIn?: number;
      tokensOut?: number;
      input?: string;
      output?: string;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Resolve project
  let projectId = body.projectId;
  if (!projectId && body.projectSlug) {
    const p = await db.project.findUnique({
      where: { slug: body.projectSlug },
    });
    projectId = p?.id;
  }
  if (!projectId) {
    // fall back to the first project (default workspace)
    const first = await db.project.findFirst({ orderBy: { createdAt: "asc" } });
    projectId = first?.id;
  }
  if (!projectId) {
    return NextResponse.json(
      { error: "No project found. Create a project first." },
      { status: 400 },
    );
  }

  const name = body.name?.trim() || `Session ${new Date().toISOString()}`;
  const steps = Array.isArray(body.steps) ? body.steps : [];

  // derive totals if not provided
  const tokenTotal =
    body.tokenTotal ??
    steps.reduce((a, s) => a + (s.tokensIn ?? 0) + (s.tokensOut ?? 0), 0);
  const costUsd = body.costUsd ?? estimateCost(steps);
  const durationMs =
    body.durationMs ??
    steps.reduce((a, s) => Math.max(a, (s.offsetMs ?? s.t ?? 0) + (s.durationMs ?? 0)), 0);
  const status =
    body.status ??
    (steps.some((s) => s.status === "failed")
      ? "failed"
      : steps.length > 0
        ? "success"
        : "running");

  const session = await db.session.create({
    data: {
      projectId,
      name,
      agent: body.agent?.trim() || "unknown-agent",
      framework: body.framework?.trim() || "Custom",
      status,
      startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
      durationMs,
      tokenTotal,
      costUsd,
      tags: Array.isArray(body.tags) ? body.tags.join(",") : "",
    },
  });

  if (steps.length > 0) {
    await db.step.createMany({
      data: steps.map((st, i) => ({
        sessionId: session.id,
        order: i,
        type: st.type ?? "llm_call",
        name: st.name ?? `step ${i + 1}`,
        offsetMs: st.offsetMs ?? st.t ?? 0,
        durationMs: st.durationMs ?? 0,
        status: st.status ?? "success",
        model: st.model ?? null,
        tokensIn: st.tokensIn ?? null,
        tokensOut: st.tokensOut ?? null,
        input: st.input ?? "",
        output: st.output ?? "",
      })),
    });
  }

  const full = await db.session.findUnique({
    where: { id: session.id },
    include: { steps: { orderBy: { order: "asc" } } },
  });

  const mapped = mapSession(full!);
  void broadcast("session:created", { session: mapped });

  return NextResponse.json({ session: mapped }, { status: 201 });
}

// Rough cost estimate per model, used when SDK omits cost.
function estimateCost(
  steps: Array<{ model?: string; tokensIn?: number; tokensOut?: number }>,
): number {
  const RATES: Record<string, { in: number; out: number }> = {
    "gpt-4o": { in: 2.5, out: 10 },
    "gpt-4o-mini": { in: 0.15, out: 0.6 },
    "claude-3.5-sonnet": { in: 3, out: 15 },
  };
  let cost = 0;
  for (const s of steps) {
    const rate = s.model ? RATES[s.model] ?? RATES["gpt-4o"] : RATES["gpt-4o"];
    cost += ((s.tokensIn ?? 0) / 1_000_000) * rate.in;
    cost += ((s.tokensOut ?? 0) / 1_000_000) * rate.out;
  }
  return Math.round(cost * 1000) / 1000;
}
