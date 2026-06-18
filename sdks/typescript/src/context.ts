// ReplayAI TypeScript SDK — context.
// AsyncLocalStorage-based current-session tracking. `withTrace()` is the
// context manager; `trace()` is the higher-order wrapper.

import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type {
  InternalSession,
  SessionStatus,
  SessionStep,
  TraceOptions,
} from "./types.js";
import { getConfig } from "./config.js";
import { estimateCost } from "./cost.js";
import { flushSession } from "./store.js";

const storage = new AsyncLocalStorage<InternalSession>();

/** Return the innermost active recording session, if any. */
export function currentSession(): InternalSession | undefined {
  return storage.getStore();
}

function nowMs(): number {
  return Date.now();
}

function shouldSample(rate: number): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  return Math.random() < rate;
}

function startSession(name: string, opts: TraceOptions | undefined): InternalSession {
  const cfg = getConfig();
  const startedAt = opts?.startedAt ?? new Date();
  return {
    id: randomUUID(),
    name,
    agent: opts?.agent ?? name,
    project: opts?.project ?? cfg.project,
    framework: opts?.framework ?? "Custom",
    tags: opts?.tags ? [...opts.tags] : [],
    startedAt,
    __startMs: startedAt.getTime(),
    steps: [],
    status: "running",
  };
}

/** Append a normalized step to the current session. No-op if no session. */
export function appendStep(step: SessionStep): void {
  const s = currentSession();
  if (!s) return;
  // Infer offset from session start if missing.
  if (step.t === undefined && step.offsetMs === undefined) {
    step.t = Math.max(0, nowMs() - s.__startMs);
  }
  if (step.offsetMs === undefined && step.t !== undefined) step.offsetMs = step.t;
  if (step.t === undefined && step.offsetMs !== undefined) step.t = step.offsetMs;
  if (step.durationMs === undefined) step.durationMs = 0;
  s.steps.push(step);
}

/** Compute final totals + status and POST the session to the API. */
async function endAndFlush(session: InternalSession): Promise<void> {
  session.endAt = new Date();
  const wallClockDuration = session.endAt.getTime() - session.startedAt.getTime();

  // Session duration = max(wall-clock, latest step end).
  let stepEndMax = 0;
  for (const s of session.steps) {
    const t = s.offsetMs ?? s.t ?? 0;
    const d = s.durationMs ?? 0;
    stepEndMax = Math.max(stepEndMax, t + d);
  }
  const durationMs = Math.max(wallClockDuration, stepEndMax);

  // Derive status.
  let status: SessionStatus = session.status;
  if (session.error !== undefined) {
    status = "failed";
  } else if (session.steps.some((s) => s.status === "failed")) {
    status = "failed";
  } else if (session.steps.length > 0) {
    status = "success";
  } else {
    status = "success";
  }

  const tokenTotal = session.steps.reduce(
    (a, s) => a + (s.tokensIn ?? 0) + (s.tokensOut ?? 0),
    0,
  );
  const costUsd = estimateCost(session.steps);

  await flushSession({
    sessionId: session.id,
    name: session.name,
    agent: session.agent,
    project: session.project,
    framework: session.framework,
    tags: session.tags,
    startedAt: session.startedAt,
    durationMs,
    status,
    tokenTotal,
    costUsd,
    steps: session.steps,
  });
}

/**
 * `withTrace` — async context manager. Wraps a function body in a recorded
 * session; on exit computes duration/tokens/cost/status and POSTs to the API.
 *
 * Errors from the wrapped function are re-thrown as-is; recording failures
 * are swallowed unless `strict` mode is on.
 */
export async function withTrace<T>(
  name: string,
  opts: TraceOptions | undefined,
  fn: () => T | Promise<T>,
): Promise<T> {
  const cfg = getConfig();
  const rate = opts?.sampleRate ?? cfg.sampleRate;
  if (!shouldSample(rate)) {
    // Not sampled: run the fn without tracing.
    return await fn();
  }

  const session = startSession(name, opts);
  return await storage.run(session, async () => {
    let result: T;
    try {
      result = await fn();
      if (session.status === "running") session.status = "success";
    } catch (err) {
      session.status = "failed";
      session.error = err;
      try {
        await endAndFlush(session);
      } catch (flushErr) {
        if (cfg.strict) throw flushErr;
      }
      throw err;
    }
    try {
      await endAndFlush(session);
    } catch (flushErr) {
      if (cfg.strict) throw flushErr;
    }
    return result;
  });
}

/** `trace` — higher-order function. Returns a wrapped fn with the same signature. */
export function trace<T extends (...args: never[]) => unknown>(
  name: string,
  opts: TraceOptions | undefined,
  fn: T,
): T {
  const wrapped = (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    return withTrace(name, opts, () => fn(...args)) as Promise<Awaited<ReturnType<T>>>;
  };
  // Preserve name/length for nicer stack traces / introspection.
  Object.defineProperty(wrapped, "name", { value: fn.name || "trace", configurable: true });
  return wrapped as unknown as T;
}
