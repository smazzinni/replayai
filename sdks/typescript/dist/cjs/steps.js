"use strict";
// ReplayAI TypeScript SDK — manual step recording.
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordStep = recordStep;
exports.recordStepSync = recordStepSync;
const context_js_1 = require("./context.js");
const redact_js_1 = require("./redact.js");
const VALID_TYPES = ["llm_call", "tool_call", "retrieval", "decision", "error"];
const VALID_STATUSES = ["success", "failed", "running", "warning"];
function coerceType(v) {
    if (v && VALID_TYPES.includes(v))
        return v;
    return "llm_call";
}
function coerceStatus(v) {
    if (v && VALID_STATUSES.includes(v))
        return v;
    return "success";
}
/**
 * Record a step into the current trace session.
 *
 * No-op when called outside a `withTrace()`/`trace()` context (unless strict
 * mode is on, in which case it warns). Inputs and outputs are redacted with
 * the configured patterns before persistence.
 */
async function recordStep(input) {
    const step = {
        type: coerceType(input.type),
        name: input.name,
        model: input.model ?? null,
        tokensIn: input.tokensIn ?? 0,
        tokensOut: input.tokensOut ?? 0,
        input: (0, redact_js_1.redactText)(input.input),
        output: (0, redact_js_1.redactText)(input.output),
        status: coerceStatus(input.status),
        t: input.t ?? input.offsetMs,
        offsetMs: input.offsetMs ?? input.t,
        durationMs: input.durationMs ?? 0,
    };
    (0, context_js_1.appendStep)(step);
}
/** Sync variant — same as `recordStep()` but without the await ceremony. */
function recordStepSync(input) {
    const step = {
        type: coerceType(input.type),
        name: input.name,
        model: input.model ?? null,
        tokensIn: input.tokensIn ?? 0,
        tokensOut: input.tokensOut ?? 0,
        input: (0, redact_js_1.redactText)(input.input),
        output: (0, redact_js_1.redactText)(input.output),
        status: coerceStatus(input.status),
        t: input.t ?? input.offsetMs,
        offsetMs: input.offsetMs ?? input.t,
        durationMs: input.durationMs ?? 0,
    };
    (0, context_js_1.appendStep)(step);
}
//# sourceMappingURL=steps.js.map