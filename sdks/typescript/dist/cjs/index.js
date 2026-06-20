"use strict";
// ReplayAI TypeScript SDK — public entry point.
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactOptional = exports.redactText = exports.estimateStepCost = exports.estimateCost = exports.getLastFlushResult = exports.flushSession = exports.ReplaySession = exports.currentSession = exports.resetConfig = exports.getConfig = exports.configure = exports.recordStepSync = exports.recordStep = exports.withTrace = exports.trace = exports.VERSION = void 0;
const config_js_1 = require("./config.js");
Object.defineProperty(exports, "configure", { enumerable: true, get: function () { return config_js_1.configure; } });
Object.defineProperty(exports, "getConfig", { enumerable: true, get: function () { return config_js_1.getConfig; } });
Object.defineProperty(exports, "resetConfig", { enumerable: true, get: function () { return config_js_1.resetConfig; } });
const context_js_1 = require("./context.js");
Object.defineProperty(exports, "currentSession", { enumerable: true, get: function () { return context_js_1.currentSession; } });
Object.defineProperty(exports, "trace", { enumerable: true, get: function () { return context_js_1.trace; } });
Object.defineProperty(exports, "withTrace", { enumerable: true, get: function () { return context_js_1.withTrace; } });
const steps_js_1 = require("./steps.js");
Object.defineProperty(exports, "recordStep", { enumerable: true, get: function () { return steps_js_1.recordStep; } });
Object.defineProperty(exports, "recordStepSync", { enumerable: true, get: function () { return steps_js_1.recordStepSync; } });
const session_js_1 = require("./session.js");
Object.defineProperty(exports, "ReplaySession", { enumerable: true, get: function () { return session_js_1.ReplaySession; } });
const store_js_1 = require("./store.js");
Object.defineProperty(exports, "flushSession", { enumerable: true, get: function () { return store_js_1.flushSession; } });
Object.defineProperty(exports, "getLastFlushResult", { enumerable: true, get: function () { return store_js_1.getLastFlushResult; } });
const cost_js_1 = require("./cost.js");
Object.defineProperty(exports, "estimateCost", { enumerable: true, get: function () { return cost_js_1.estimateCost; } });
Object.defineProperty(exports, "estimateStepCost", { enumerable: true, get: function () { return cost_js_1.estimateStepCost; } });
const redact_js_1 = require("./redact.js");
Object.defineProperty(exports, "redactText", { enumerable: true, get: function () { return redact_js_1.redactText; } });
Object.defineProperty(exports, "redactOptional", { enumerable: true, get: function () { return redact_js_1.redactOptional; } });
/** SDK version. */
exports.VERSION = "0.4.2";
// Default export is a namespace object — handy for CJS consumers and as a
// single `import replayai from "@smazzinni/sdk"` import.
const replayai = {
    VERSION: exports.VERSION,
    trace: context_js_1.trace,
    withTrace: context_js_1.withTrace,
    recordStep: steps_js_1.recordStep,
    recordStepSync: steps_js_1.recordStepSync,
    configure: config_js_1.configure,
    getConfig: config_js_1.getConfig,
    resetConfig: config_js_1.resetConfig,
    currentSession: context_js_1.currentSession,
    ReplaySession: session_js_1.ReplaySession,
    flushSession: store_js_1.flushSession,
    getLastFlushResult: store_js_1.getLastFlushResult,
    estimateCost: cost_js_1.estimateCost,
    estimateStepCost: cost_js_1.estimateStepCost,
    redactText: redact_js_1.redactText,
    redactOptional: redact_js_1.redactOptional,
};
exports.default = replayai;
//# sourceMappingURL=index.js.map