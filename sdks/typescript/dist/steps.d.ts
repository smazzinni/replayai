import type { RecordStepInput } from "./types.js";
/**
 * Record a step into the current trace session.
 *
 * No-op when called outside a `withTrace()`/`trace()` context (unless strict
 * mode is on, in which case it warns). Inputs and outputs are redacted with
 * the configured patterns before persistence.
 */
export declare function recordStep(input: RecordStepInput): Promise<void>;
/** Sync variant — same as `recordStep()` but without the await ceremony. */
export declare function recordStepSync(input: RecordStepInput): void;
//# sourceMappingURL=steps.d.ts.map