"use strict";
// ReplayAI TypeScript SDK — redaction.
// Secrets are scrubbed from step input/output before they're persisted.
//
// Strategy:
//  1. Apply the configured regex patterns (OpenAI keys, Bearer tokens, etc.).
//     Each match is replaced with `[REDACTED:<sha256[:8]>]` — a stable,
//     per-secret hash so the same key redacts to the same marker (lets you
//     spot the same secret across steps without leaking it).
//  2. If `REPLAYAI_REDACT_STRICT != "false"`, run entropy-based detection on
//     long high-entropy tokens (Shannon entropy > 4.5 + length > 20) that
//     aren't on the whitelist (UUIDs, ISO timestamps, URLs, snake_case).
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDACTED = void 0;
exports.redactMarker = redactMarker;
exports.shannonEntropy = shannonEntropy;
exports.redactText = redactText;
exports.redactOptional = redactOptional;
exports._clearMarkerCache = _clearMarkerCache;
const node_crypto_1 = require("node:crypto");
const config_js_1 = require("./config.js");
// ---- Hash-based marker ----------------------------------------------------
/** Cache secret → marker so the same secret always redacts to the same string. */
const markerCache = new Map();
/** Return `[REDACTED:<sha256[:8]>]` for `secret`, cached per value. */
function redactMarker(secret) {
    let m = markerCache.get(secret);
    if (m !== undefined)
        return m;
    const hash = (0, node_crypto_1.createHash)("sha256").update(secret, "utf8").digest("hex");
    m = `[REDACTED:${hash.slice(0, 8)}]`;
    markerCache.set(secret, m);
    return m;
}
/** Legacy exported alias. Returns the same marker shape. */
exports.REDACTED = "[REDACTED]";
// ---- Whitelist (entropy detection skips) ----------------------------------
const WHITELIST_PATTERNS = [
    // UUID (8-4-4-4-12 hex).
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    // ISO 8601 timestamp (with optional milliseconds + timezone).
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/,
    // URL.
    /^https?:\/\/[^\s]+$/,
    // snake_case identifier (lowercase + underscores + digits).
    /^[a-z][a-z0-9_]*$/,
    // kebab-case identifier (lowercase + hyphens + digits).
    /^[a-z][a-z0-9-]*$/,
];
function isWhitelisted(token) {
    for (const re of WHITELIST_PATTERNS) {
        if (re.test(token))
            return true;
    }
    return false;
}
// ---- Shannon entropy ------------------------------------------------------
/** Shannon entropy (base-2) of a string. Higher = more random. */
function shannonEntropy(s) {
    if (!s)
        return 0;
    const counts = new Map();
    for (const ch of s)
        counts.set(ch, (counts.get(ch) ?? 0) + 1);
    let h = 0;
    const len = s.length;
    for (const count of counts.values()) {
        const p = count / len;
        h -= p * Math.log2(p);
    }
    return h;
}
// ---- Stringification ------------------------------------------------------
function stringify(value) {
    if (value === null || value === undefined)
        return "";
    if (typeof value === "string")
        return value;
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return String(value);
    }
    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        }
        catch {
            try {
                return String(value);
            }
            catch {
                return "[unserializable]";
            }
        }
    }
    return String(value);
}
// ---- Entropy-based detection ----------------------------------------------
/** Match long runs of base64/url-safe characters — candidate secrets. */
const ENTROPY_CANDIDATE = /[A-Za-z0-9+/=_-]{20,}/g;
/** Apply entropy-based redaction. No-op when `REPLAYAI_REDACT_STRICT=false`. */
function applyEntropyRedaction(text) {
    return text.replace(ENTROPY_CANDIDATE, (token) => {
        if (isWhitelisted(token))
            return token;
        const ent = shannonEntropy(token);
        if (ent > 4.5)
            return redactMarker(token);
        return token;
    });
}
// ---- Public API -----------------------------------------------------------
/**
 * Redact secrets from any value, returning a string.
 *
 * Non-string inputs are first stringified (JSON for objects) so nested
 * secrets are scanned too. Each configured regex pattern is applied in
 * order; matches are replaced with `[REDACTED:<sha256[:8]>]`. Then, if
 * `REPLAYAI_REDACT_STRICT != "false"`, entropy-based detection scrubs any
 * remaining long high-entropy tokens that aren't on the whitelist.
 */
function redactText(value) {
    let text = stringify(value);
    if (!text)
        return "";
    const cfg = (0, config_js_1.getConfig)();
    for (const re of cfg.redactPatterns) {
        // Each call needs a fresh lastIndex since these regexes have the `g` flag.
        re.lastIndex = 0;
        try {
            text = text.replace(re, (match) => redactMarker(match));
        }
        catch {
            // Malformed user-supplied patterns shouldn't crash the agent.
            continue;
        }
    }
    if (cfg.redactStrict) {
        try {
            text = applyEntropyRedaction(text);
        }
        catch {
            // Entropy detection must never break recording.
        }
    }
    return text;
}
/** Redact an optional string. `null`/`undefined` pass through unchanged. */
function redactOptional(value) {
    if (value === null || value === undefined)
        return null;
    return redactText(value);
}
/** Internal: clear the marker cache (tests only). */
function _clearMarkerCache() {
    markerCache.clear();
}
//# sourceMappingURL=redact.js.map