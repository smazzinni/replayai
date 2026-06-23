import { configure, getConfig, resetConfig } from "./config.js";
import { currentSession, isSampled, trace, withTrace } from "./context.js";
import { recordStep, recordStepSync } from "./steps.js";
import { ReplaySession } from "./session.js";
import { flushSession } from "./store.js";
import { estimateCost, estimateStepCost } from "./cost.js";
import { redactText, redactOptional, redactMarker } from "./redact.js";
import type { AgentProject, AgentSession, CapturedException, CompareDivergence, CompareResult, ConfigOptions, ExportLang, InternalSession, LastFlushResult, MockEntry, MockMatchOptions, RecordStepInput, ReplaySessionOptions, RunOptions, SessionStatus, SessionStep, StackFrame, StepStatus, StepType, Trace, TraceOptions } from "./types.js";
/** SDK version. */
export declare const VERSION = "0.7.0";
export { trace, withTrace, isSampled, recordStep, recordStepSync, configure, getConfig, resetConfig, currentSession, ReplaySession, flushSession, estimateCost, estimateStepCost, redactText, redactOptional, redactMarker, };
export type { AgentProject, AgentSession, CapturedException, CompareDivergence, CompareResult, ConfigOptions, ExportLang, InternalSession, LastFlushResult, MockEntry, MockMatchOptions, RecordStepInput, ReplaySessionOptions, RunOptions, SessionStatus, SessionStep, StackFrame, StepStatus, StepType, Trace, TraceOptions, };
declare const replayai: {
    VERSION: string;
    trace: typeof trace;
    withTrace: typeof withTrace;
    isSampled: typeof isSampled;
    recordStep: typeof recordStep;
    recordStepSync: typeof recordStepSync;
    configure: typeof configure;
    getConfig: typeof getConfig;
    resetConfig: typeof resetConfig;
    currentSession: typeof currentSession;
    ReplaySession: typeof ReplaySession;
    flushSession: typeof flushSession;
    estimateCost: typeof estimateCost;
    estimateStepCost: typeof estimateStepCost;
    redactText: typeof redactText;
    redactOptional: typeof redactOptional;
    redactMarker: typeof redactMarker;
};
export default replayai;
//# sourceMappingURL=index.d.ts.map