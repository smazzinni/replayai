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
    /** Per-request timeout in ms. Default 30000. */
    timeoutMs: number;
    /** Max steps retained per session before truncation. Default 200. */
    maxSteps: number;
    /** When false, entropy-based redaction is disabled. Default true. */
    redactStrict: boolean;
}
/** Resolve the active config from env vars + programmatic overrides. */
export declare function resolveConfig(): ResolvedConfig;
/** Update SDK config programmatically. Only supplied keys are changed. */
export declare function configure(opts: ConfigOptions): ResolvedConfig;
/** Get the active config (re-resolves if `configure()` was called). */
export declare function getConfig(): ResolvedConfig;
/** Reset to env-only config. Useful for tests. */
export declare function resetConfig(): void;
/**
 * Get the module-level strict flag (mirrors `config.strict`).
 * Use `setStrictMode()` to change it.
 *
 * Note: the Python SDK exposes `replayai.strict_mode` as a settable module
 * attribute. TypeScript doesn't support settable module exports without a
 * hack, so we use explicit get/set functions instead. This is safer than
 * the `export let` pattern (which breaks when reassigned from another module).
 */
export declare function getStrictMode(): boolean;
/** Set the module-level strict flag (updates config.strict too). */
export declare function setStrictMode(value: boolean): void;
/** @internal Kept for backward compatibility — prefer getStrictMode(). */
export declare const _strictMode: {
    readonly value: boolean;
};
//# sourceMappingURL=config.d.ts.map