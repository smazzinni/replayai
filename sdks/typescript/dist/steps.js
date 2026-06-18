// ReplayAI TypeScript SDK — manual step recording.
import { appendStep } from "./context.js";
import { redactText } from "./redact.js";
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
export async function recordStep(input) {
    const step = {
        type: coerceType(input.type),
        name: input.name,
        model: input.model ?? null,
        tokensIn: input.tokensIn ?? 0,
        tokensOut: input.tokensOut ?? 0,
        input: redactText(input.input),
        output: redactText(input.output),
        status: coerceStatus(input.status),
        t: input.t ?? input.offsetMs,
        offsetMs: input.offsetMs ?? input.t,
        durationMs: input.durationMs ?? 0,
    };
    appendStep(step);
}
/** Sync variant — same as `recordStep()` but without the await ceremony. */
export function recordStepSync(input) {
    const step = {
        type: coerceType(input.type),
        name: input.name,
        model: input.model ?? null,
        tokensIn: input.tokensIn ?? 0,
        tokensOut: input.tokensOut ?? 0,
        input: redactText(input.input),
        output: redactText(input.output),
        status: coerceStatus(input.status),
        t: input.t ?? input.offsetMs,
        offsetMs: input.offsetMs ?? input.t,
        durationMs: input.durationMs ?? 0,
    };
    appendStep(step);
}
//# sourceMappingURL=steps.js.map