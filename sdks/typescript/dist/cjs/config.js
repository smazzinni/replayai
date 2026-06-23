"use strict";
// ReplayAI TypeScript SDK — configuration.
// Reads env vars on first access; `configure()` overrides programmatically.
Object.defineProperty(exports, "__esModule", { value: true });
exports._strictMode = exports.DEFAULT_REDACT_PATTERNS = void 0;
exports.resolveConfig = resolveConfig;
exports.configure = configure;
exports.getConfig = getConfig;
exports.resetConfig = resetConfig;
exports.getStrictMode = getStrictMode;
exports.setStrictMode = setStrictMode;
/** Default redaction patterns. Applied to every step's input/output. */
exports.DEFAULT_REDACT_PATTERNS = [
    // OpenAI-style API keys (legacy + project + service-account + admin prefixes).
    /sk-(?:proj|svcacct|admin)?-?[a-zA-Z0-9]{20,}/g,
    /Bearer\s+[a-zA-Z0-9._\-]+/g, // Authorization header tokens
    /password=[^\s&]+/gi, // password=... in URLs / form bodies
    /["']?api[_-]?key["']?\s*[:=]\s*["']?[a-zA-Z0-9]{20,}/gi, // api_key=...
];
function envString(name, fallback) {
    const v = process.env[name];
    return v === undefined || v === "" ? fallback : v;
}
function envNumber(name, fallback) {
    const v = process.env[name];
    if (v === undefined || v === "")
        return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}
function envBool(name, fallback) {
    const v = process.env[name];
    if (v === undefined || v === "")
        return fallback;
    return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes" || v.toLowerCase() === "on";
}
function parseRedactPatterns(raw) {
    if (!raw || raw.trim() === "")
        return null;
    const out = [];
    for (const piece of raw.split(",")) {
        const p = piece.trim();
        if (!p)
            continue;
        try {
            out.push(new RegExp(p, "g"));
        }
        catch {
            // If the user supplied a malformed regex, escape it and try again.
            const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            try {
                out.push(new RegExp(escaped, "g"));
            }
            catch {
                /* skip unparseable */
            }
        }
    }
    return out.length > 0 ? out : null;
}
let cached = null;
let overrides = {};
/** Resolve the active config from env vars + programmatic overrides. */
function resolveConfig() {
    if (cached)
        return cached;
    const storageRaw = overrides.storage ?? envString("REPLAYAI_STORAGE") ?? "cloud";
    const storage = storageRaw === "local" || storageRaw === "cloud" || storageRaw === "both"
        ? storageRaw
        : "cloud";
    let redactPatterns = null;
    if (overrides.redactPatterns) {
        redactPatterns = overrides.redactPatterns.map((p) => typeof p === "string" ? safeRegex(p) : p);
    }
    else {
        redactPatterns = parseRedactPatterns(envString("REPLAYAI_REDACT_PATTERNS"));
    }
    cached = {
        project: overrides.project ?? envString("REPLAYAI_PROJECT"),
        token: overrides.token ?? envString("REPLAYAI_TOKEN"),
        storage,
        storagePath: overrides.storagePath ?? envString("REPLAYAI_STORAGE_PATH") ?? "./ReplayAI",
        apiUrl: (overrides.apiUrl ?? envString("REPLAYAI_API_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
        dashboardUrl: overrides.dashboardUrl ?? envString("REPLAYAI_DASHBOARD_URL") ?? "http://localhost:3000",
        sampleRate: overrides.sampleRate ?? envNumber("REPLAYAI_SAMPLE_RATE", 1.0),
        strict: overrides.strict ?? envBool("REPLAYAI_STRICT", false),
        redactPatterns: redactPatterns ?? [...exports.DEFAULT_REDACT_PATTERNS],
        timeoutMs: overrides.timeoutMs ?? envNumber("REPLAYAI_TIMEOUT", 30000),
        maxSteps: overrides.maxSteps ?? envNumber("REPLAYAI_MAX_STEPS", 200),
        redactStrict: overrides.redactStrict ?? envBool("REPLAYAI_REDACT_STRICT", true),
    };
    return cached;
}
function safeRegex(s) {
    try {
        return new RegExp(s, "g");
    }
    catch {
        return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    }
}
/** Update SDK config programmatically. Only supplied keys are changed. */
function configure(opts) {
    overrides = { ...overrides, ...opts };
    cached = null; // force re-resolve on next read
    return resolveConfig();
}
/** Get the active config (re-resolves if `configure()` was called). */
function getConfig() {
    return resolveConfig();
}
/** Reset to env-only config. Useful for tests. */
function resetConfig() {
    overrides = {};
    cached = null;
}
/**
 * Get the module-level strict flag (mirrors `config.strict`).
 * Use `setStrictMode()` to change it.
 *
 * Note: the Python SDK exposes `replayai.strict_mode` as a settable module
 * attribute. TypeScript doesn't support settable module exports without a
 * hack, so we use explicit get/set functions instead. This is safer than
 * the `export let` pattern (which breaks when reassigned from another module).
 */
function getStrictMode() {
    return getConfig().strict;
}
/** Set the module-level strict flag (updates config.strict too). */
function setStrictMode(value) {
    configure({ strict: value });
}
/** @internal Kept for backward compatibility — prefer getStrictMode(). */
exports._strictMode = { get value() { return getStrictMode(); } };
//# sourceMappingURL=config.js.map