import type { ConfigOptions } from "./types.js";
/** Default redaction patterns. Applied to every step's input/output. */
export declare const DEFAULT_REDACT_PATTERNS: RegExp[];
export type StorageMode = "local" | "cloud" | "both";
export interface ResolvedConfig {
    project?: string;
    token?: string;
    storage: StorageMode;
    storagePath: string;
    apiUrl: string;
    dashboardUrl: string;
    sampleRate: number;
    strict: boolean;
    redactPatterns: RegExp[];
}
/** Resolve the active config from env vars + programmatic overrides. */
export declare function resolveConfig(): ResolvedConfig;
/** Update SDK config programmatically. Only supplied keys are changed. */
export declare function configure(opts: ConfigOptions): ResolvedConfig;
/** Get the active config (re-resolves if `configure()` was called). */
export declare function getConfig(): ResolvedConfig;
/** Reset to env-only config. Useful for tests. */
export declare function resetConfig(): void;
/** Module-level strict flag, mirrored from config.strict (parity with Python SDK). */
export declare let strict_mode: boolean;
export declare function _syncStrictFlag(): void;
//# sourceMappingURL=config.d.ts.map