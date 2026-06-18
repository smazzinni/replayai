// Server-only mappers: convert Prisma rows to the API response shapes
// defined in src/lib/replay-data.ts. Imported only by API routes.

import type { Prisma } from "@prisma/client";
import type { AgentSession, Project, SessionStep } from "@/lib/replay-data";

type SessionWithSteps = Prisma.SessionGetPayload<{
  include: { steps: true }
}>;
type SessionWithProjectAndSteps = Prisma.SessionGetPayload<{
  include: { project: true; steps: true }
}>;
type SessionSummary = Prisma.SessionGetPayload<{
  include: { _count: { select: { steps: true } } }
}>;
type ProjectWithCount = Prisma.ProjectGetPayload<{
  include: { _count: { select: { sessions: true } } }
}>;

export function mapStep(row: {
  id: string;
  order: number;
  type: string;
  name: string;
  offsetMs: number;
  durationMs: number;
  status: string;
  model: string | null;
  tokensIn: number | null;
  tokensOut: number | null;
  input: string;
  output: string;
}): SessionStep {
  return {
    id: row.id,
    type: row.type as SessionStep["type"],
    name: row.name,
    t: row.offsetMs,
    durationMs: row.durationMs,
    status: row.status as SessionStep["status"],
    model: row.model,
    tokensIn: row.tokensIn,
    tokensOut: row.tokensOut,
    input: row.input,
    output: row.output,
  };
}

export function mapSession(row: SessionWithSteps): AgentSession {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    agent: row.agent,
    framework: row.framework,
    status: row.status as AgentSession["status"],
    startedAt: row.startedAt.toISOString(),
    durationMs: row.durationMs,
    tokenTotal: row.tokenTotal,
    costUsd: row.costUsd,
    tags: row.tags ? row.tags.split(",").filter(Boolean) : [],
    steps: row.steps
      .sort((a, b) => a.order - b.order)
      .map(mapStep),
  };
}

export function mapSessionWithProject(
  row: SessionWithProjectAndSteps,
): AgentSession & { project: Project } {
  return {
    ...mapSession(row),
    project: mapProject(row.project),
  };
}

/** Lightweight mapping for list views — no step payloads, just a count. */
export function mapSessionSummary(row: SessionSummary): AgentSession {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    agent: row.agent,
    framework: row.framework,
    status: row.status as AgentSession["status"],
    startedAt: row.startedAt.toISOString(),
    durationMs: row.durationMs,
    tokenTotal: row.tokenTotal,
    costUsd: row.costUsd,
    tags: row.tags ? row.tags.split(",").filter(Boolean) : [],
    steps: [],
    stepCount: row._count.steps,
  };
}

export function mapProject(
  row:
    | {
        id: string;
        name: string;
        slug: string;
        framework: string;
        description: string | null;
        createdAt: Date;
      }
    | ProjectWithCount,
): Project {
  const sessionCount =
    "_count" in row ? (row as ProjectWithCount)._count.sessions : undefined;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    framework: row.framework,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    sessionCount,
  };
}
