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
}
export declare function getLastFlushResult(): FlushResult | null;
export declare function _resetLastFlushResult(): void;
/** POST a recorded session to `${apiUrl}/api/sessions`. */
export declare function flushSession(payload: FlushPayload): Promise<FlushResult>;
/** GET `/api/sessions/${id}` — used by `ReplaySession.run()`. */
export declare function fetchSession(sessionId: string): Promise<{
    ok: true;
    session: unknown;
} | {
    ok: false;
    status: number;
    body: string;
}>;
/** GET `/api/sessions/${id}/export?lang=...` — used by `ReplaySession.export()`. */
export declare function fetchExport(sessionId: string, lang: "pytest" | "jest"): Promise<string>;
//# sourceMappingURL=store.d.ts.map