import type { InternalSession, SessionStep, TraceOptions } from "./types.js";
/** Return the innermost active recording session, if any. */
export declare function currentSession(): InternalSession | undefined;
/** Append a normalized step to the current session. No-op if no session. */
export declare function appendStep(step: SessionStep): void;
/**
 * `withTrace` — async context manager. Wraps a function body in a recorded
 * session; on exit computes duration/tokens/cost/status and POSTs to the API.
 *
 * Errors from the wrapped function are re-thrown as-is; recording failures
 * are swallowed unless `strict` mode is on.
 */
export declare function withTrace<T>(name: string, opts: TraceOptions | undefined, fn: () => T | Promise<T>): Promise<T>;
/** `trace` — higher-order function. Returns a wrapped fn with the same signature. */
export declare function trace<T extends (...args: never[]) => unknown>(name: string, opts: TraceOptions | undefined, fn: T): T;
//# sourceMappingURL=context.d.ts.map