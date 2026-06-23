// Server-only: shared cost estimation + validation helpers for session ingest.
//
// Kept separate from the API route so the rates live in one place and can be
// imported by other server routes (e.g. /api/sessions/[id]) if needed. The
// Python + TypeScript SDKs ship their own copy of this table — keep them in
// sync when you add a model here.

/** Per 1M-token USD rates for models the dashboard recognizes. */
export const MODEL_RATES: Record<string, { in: number; out: number }> = {
  "gpt-4o": { in: 2.5, out: 10 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4-turbo": { in: 10, out: 30 },
  "gpt-3.5-turbo": { in: 0.5, out: 1.5 },
  "claude-3.5-sonnet": { in: 3, out: 15 },
  "claude-3-5-haiku": { in: 0.8, out: 4 },
  "claude-3-opus": { in: 15, out: 75 },
  "gemini-1.5-pro": { in: 1.25, out: 5 },
  "gemini-1.5-flash": { in: 0.075, out: 0.3 },
  "llama-3.1-70b": { in: 0.59, out: 0.79 },
};

/** Fallback rate (GPT-4o) used when a model isn't in the table. */
const FALLBACK_RATE = MODEL_RATES["gpt-4o"];

/** Estimate total USD cost across a list of step-like objects. */
export function estimateCost(
  steps: Array<{
    model?: string | null;
    tokensIn?: number | null;
    tokensOut?: number | null;
  }>,
): number {
  let cost = 0;
  for (const s of steps) {
    const rate = s.model && MODEL_RATES[s.model] ? MODEL_RATES[s.model] : FALLBACK_RATE;
    cost += ((s.tokensIn ?? 0) / 1_000_000) * rate.in;
    cost += ((s.tokensOut ?? 0) / 1_000_000) * rate.out;
  }
  return Math.round(cost * 1000) / 1000;
}

// ---- Validation -----------------------------------------------------------

export const VALID_SESSION_STATUSES = ["success", "failed", "running"] as const;
export const VALID_STEP_TYPES = [
  "llm_call",
  "tool_call",
  "retrieval",
  "decision",
  "error",
] as const;
export const VALID_STEP_STATUSES = [
  "success",
  "failed",
  "running",
  "warning",
] as const;
export const VALID_ORDER_BY = [
  "startedAt",
  "durationMs",
  "costUsd",
  "tokenTotal",
] as const;

/** True if `v` is a non-empty string after trimming. */
export function isNonEmpty(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Clamp a number to [min, max]; return fallback on invalid. */
export function clampInt(
  v: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

/** Sanitize a step input/output string — truncate very long payloads. */
export function sanitizeStepText(v: unknown, max = 100_000): string {
  if (typeof v !== "string") return v == null ? "" : String(v);
  return v.length > max ? v.slice(0, max) + "\n…[truncated]" : v;
}
