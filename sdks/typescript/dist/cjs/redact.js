"use strict";
// ReplayAI TypeScript SDK — redaction.
// Secrets are scrubbed from step input/output before they're persisted.
Object.defineProperty(exports, "__esModule", { value: true });
exports.REDACTED = void 0;
exports.redactText = redactText;
exports.redactOptional = redactOptional;
const config_js_1 = require("./config.js");
exports.REDACTED = "[REDACTED]";
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
/**
 * Redact secrets from any value, returning a string.
 *
 * Non-string inputs are first stringified (JSON for objects) so nested
 * secrets are scanned too. Each configured regex pattern is applied in
 * order; matches are replaced with `[REDACTED]`.
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
            text = text.replace(re, exports.REDACTED);
        }
        catch {
            // Malformed user-supplied patterns shouldn't crash the agent.
            continue;
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
//# sourceMappingURL=redact.js.map