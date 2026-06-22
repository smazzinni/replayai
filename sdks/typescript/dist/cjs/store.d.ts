import type { SessionStatus, SessionStep } from "./types.js";
export interface FlushPayload {
    /** Local correlation id (UUIDv4); the API assigns the canonical id. */
    sessionId: string;
    name: string;
    agent: string;
    project?: string;
    framework: string;
    tags: string[];
    startedAt: Date;
    durationMs: number;
    status: SessionStatus;
    tokenTotal: number;
    costUsd: number;
    steps: SessionStep[];
}
export interface FlushResult {
    ok: boolean;
    sessionId?: string;
    url?: string;
    error?: string;
    /** True when the payload was truncated before flush. */
    truncated?: boolean;
    /** True when the payload was placed on the retry queue instead of being delivered. */
    queued?: boolean;
}
/**
 * POST a recorded session to `${apiUrl}/api/sessions` with timeout, retry, and
 * in-memory queue fallback. Drains any queued payloads first. Returns the
 * result of the *new* flush (queued payloads are best-effort and don't affect
 * the caller's view unless the new payload itself was queued).
 */
export declare function flushSession(payload: FlushPayload): Promise<FlushResult>;
/** GET `/api/sessions/${id}` — used by `ReplaySession.load()`. Includes timeout
 *  + retry for parity with `flushSession`. */
export declare function fetchSession(sessionId: string): Promise<{
    ok: true;
    session: unknown;
} | {
    ok: false;
    status: number;
    body: string;
}>;
/** GET `/api/sessions/${id}/export?lang=...` — used by `ReplaySession.export()`.
 *  Includes timeout + retry. */
export declare function fetchExport(sessionId: string, lang: "pytest" | "jest"): Promise<string>;
/** Internal helper for tests: peek at the current queue length. */
export declare function _queueLength(): number;
/** Internal helper for tests: clear the queue. */
export declare function _clearQueue(): void;
/** Generate a fresh local correlation id (UUIDv4). */
export declare function newLocalSessionId(): string;
//# sourceMappingURL=store.d.ts.map