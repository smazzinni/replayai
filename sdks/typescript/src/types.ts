// ReplayAI TypeScript SDK — shared types.
// Mirrors the API shape defined in src/app/api/sessions/route.ts and
// src/lib/replay-data.ts so what the SDK POSTs matches what the API expects.

export type StepType =
  | "llm_call"
  | "tool_call"
  | "retrieval"
  | "decision"
  | "error";

export type StepStatus = "success" | "failed" | "running" | "warning";
export type SessionStatus = "success" | "failed" | "running";

/** A single recorded step inside a session. Mirrors the API's SessionStep. */
export interface SessionStep {
  id?: string;
  type: StepType;
  name: string;
  /** ms offset from session start (alias of offsetMs) */
  t?: number;
  offsetMs?: number;
  durationMs?: number;
  status: StepStatus;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  input?: string;
  output?: string;
}

/** A full agent session as returned by the API. */
export interface AgentSession {
  id: string;
  projectId?: string;
  name: string;
  agent: string;
  framework: string;
  status: SessionStatus;
  startedAt: string; // ISO
  durationMs: number;
  tokenTotal: number;
  costUsd: number;
  tags: string[];
  steps: SessionStep[];
  /** Present on list responses. */
  stepCount?: number;
  /** Present when joined with project on the detail endpoint. */
  project?: AgentProject;
}

export interface AgentProject {
  id: string;
  name: string;
  slug: string;
  framework: string;
  description?: string | null;
  createdAt: string;
  sessionCount?: number;
}

/** Options accepted by `trace()` and `withTrace()`. */
export interface TraceOptions {
  /** Project slug or id. Falls back to REPLAYAI_PROJECT env var. */
  project?: string;
  tags?: string[];
  framework?: string;
  startedAt?: Date;
  /** Agent name (defaults to the trace name). */
  agent?: string;
  /** Per-call override of the sample rate (0.0–1.0). */
  sampleRate?: number;
}

/** Lightweight view of a recorded/replayed trace. */
export interface Trace {
  stepCount: number;
  status: SessionStatus;
  steps: SessionStep[];
  durationMs?: number;
  tokenTotal?: number;
  costUsd?: number;
  sessionId?: string;
  sessionUrl?: string;
}

export interface ReplaySessionOptions {
  liveLlm?: boolean;
}

export interface RunOptions {
  agent: string;
  framework?: string;
}

export interface RecordStepInput {
  type?: StepType;
  name: string;
  model?: string | null;
  tokensIn?: number;
  tokensOut?: number;
  input?: unknown;
  output?: unknown;
  status?: StepStatus;
  /** ms offset from session start; inferred if omitted. */
  offsetMs?: number;
  /** alias for offsetMs */
  t?: number;
  durationMs?: number;
}

export interface ConfigOptions {
  project?: string;
  token?: string;
  storage?: "local" | "cloud" | "both";
  storagePath?: string;
  apiUrl?: string;
  dashboardUrl?: string;
  sampleRate?: number;
  strict?: boolean;
  redactPatterns?: Array<string | RegExp>;
}

/**
 * Internal representation of a session being recorded. Populated by
 * `withTrace()`/`trace()` and flushed by `store.flushSession()`.
 */
export interface InternalSession {
  id: string;
  name: string;
  agent: string;
  project?: string;
  framework: string;
  tags: string[];
  startedAt: Date;
  /** wall-clock ms captured on enter — used for offset inference */
  __startMs: number;
  steps: SessionStep[];
  status: SessionStatus;
  error?: unknown;
  endAt?: Date;
}

export type ExportLang = "pytest" | "jest";
