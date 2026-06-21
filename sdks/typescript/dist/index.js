// ReplayAI TypeScript SDK — public entry point.
import { configure, getConfig, resetConfig } from "./config.js";
import { currentSession, isSampled, trace, withTrace } from "./context.js";
import { recordStep, recordStepSync } from "./steps.js";
import { ReplaySession } from "./session.js";
import { flushSession } from "./store.js";
import { estimateCost, estimateStepCost } from "./cost.js";
import { redactText, redactOptional, redactMarker } from "./redact.js";
/** SDK version. */
export const VERSION = "0.6.0";
export { trace, withTrace, isSampled, recordStep, recordStepSync, configure, getConfig, resetConfig, currentSession, ReplaySession, flushSession, estimateCost, estimateStepCost, redactText, redactOptional, redactMarker, };
// Default export is a namespace object — handy for CJS consumers and as a
// single `import replayai from "@smazzinni/sdk"` import.
const replayai = {
    VERSION,
    trace,
    withTrace,
    isSampled,
    recordStep,
    recordStepSync,
    configure,
    getConfig,
    resetConfig,
    currentSession,
    ReplaySession,
    flushSession,
    estimateCost,
    estimateStepCost,
    redactText,
    redactOptional,
    redactMarker,
};
export default replayai;
//# sourceMappingURL=index.js.map