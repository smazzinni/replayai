import type { InternalSession, SessionStep, StackFrame, TraceOptions } from "./types.js";
/** Return the innermost active recording session, if any. */
export declare function currentSession(): InternalSession | undefined;
/** True iff the current context is sampled (will be flushed to the API). */
export declare function isSampled(): boolean;
/** Append a normalized step to the current session. Warns (no-op) if no
 *  session is active so users learn to wrap their code in `withTrace()`. */
export declare function appendStep(step: SessionStep): void;
/**
 * Parse a V8-style stack trace string into structured frames. Best-effort —
 * sets `extractionFailed: true` (via the caller) on any throw. Each frame:
 *   { file?, line?, column?, function? }
 *
 * Handles lines like:
 *   "    at foo (/path/file.js:10:20)"
 *   "    at /path/file.js:10:20"
 *   "    at Object.<anonymous> (/path/file.js:5:1)"
 *   "    at Module._compile (node:internal/modules/cjs/loader:999:30)"
 */
export declare function parseStackTrace(stack: string | undefined | null): StackFrame[];
/**
 * `withTrace` — async context manager. Wraps a function body in a recorded
 * session; on exit computes duration/tokens/cost/status and POSTs to the API.
 *
 * Always enters the AsyncLocalStorage run — even when not sampled — so that
 * recordStep() still has a session to attach to. Only the API flush is gated
 * by the sampler (errors always flush regardless of sampling).
 *
 * Errors from the wrapped function are re-thrown as-is; recording failures
 * are swallowed unless `strict` mode is on.
 */
export declare function withTrace<T>(name: string, opts: TraceOptions | undefined, fn: () => T | Promise<T>): Promise<T>;
/** `trace` — higher-order function. Returns a wrapped fn with the same signature. */
export declare function trace<T extends (...args: never[]) => unknown>(name: string, opts: TraceOptions | undefined, fn: T): T;
//# sourceMappingURL=context.d.ts.map