import { configure, getConfig, resetConfig } from "./config.js";
import { currentSession, trace, withTrace } from "./context.js";
import { recordStep, recordStepSync } from "./steps.js";
import { ReplaySession } from "./session.js";
import { flushSession, getLastFlushResult } from "./store.js";
import { estimateCost, estimateStepCost } from "./cost.js";
import { redactText, redactOptional } from "./redact.js";
import type { AgentProject, AgentSession, ConfigOptions, ExportLang, InternalSession, RecordStepInput, ReplaySessionOptions, RunOptions, SessionStatus, SessionStep, StepStatus, StepType, Trace, TraceOptions } from "./types.js";
/** SDK version. */
export declare const VERSION = "0.4.1";
export { trace, withTrace, recordStep, recordStepSync, configure, getConfig, resetConfig, currentSession, ReplaySession, flushSession, getLastFlushResult, estimateCost, estimateStepCost, redactText, redactOptional, };
export type { AgentProject, AgentSession, ConfigOptions, ExportLang, InternalSession, RecordStepInput, ReplaySessionOptions, RunOptions, SessionStatus, SessionStep, StepStatus, StepType, Trace, TraceOptions, };
declare const replayai: {
    VERSION: string;
    trace: typeof trace;
    withTrace: typeof withTrace;
    recordStep: typeof recordStep;
    recordStepSync: typeof recordStepSync;
    configure: typeof configure;
    getConfig: typeof getConfig;
    resetConfig: typeof resetConfig;
    currentSession: typeof currentSession;
    ReplaySession: typeof ReplaySession;
    flushSession: typeof flushSession;
    getLastFlushResult: typeof getLastFlushResult;
    estimateCost: typeof estimateCost;
    estimateStepCost: typeof estimateStepCost;
    redactText: typeof redactText;
    redactOptional: typeof redactOptional;
};
export default replayai;
//# sourceMappingURL=index.d.ts.map