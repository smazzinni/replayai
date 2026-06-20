// ReplayAI TypeScript SDK — public entry point.

import { configure, getConfig, resetConfig } from "./config.js";
import { currentSession, trace, withTrace } from "./context.js";
import { recordStep, recordStepSync } from "./steps.js";
import { ReplaySession } from "./session.js";
import { flushSession, getLastFlushResult } from "./store.js";
import { estimateCost, estimateStepCost } from "./cost.js";
import { redactText, redactOptional } from "./redact.js";
import type {
  AgentProject,
  AgentSession,
  ConfigOptions,
  ExportLang,
  InternalSession,
  RecordStepInput,
  ReplaySessionOptions,
  RunOptions,
  SessionStatus,
  SessionStep,
  StepStatus,
  StepType,
  Trace,
  TraceOptions,
} from "./types.js";

/** SDK version. */
export const VERSION = "0.4.3";

export {
  trace,
  withTrace,
  recordStep,
  recordStepSync,
  configure,
  getConfig,
  resetConfig,
  currentSession,
  ReplaySession,
  flushSession,
  getLastFlushResult,
  estimateCost,
  estimateStepCost,
  redactText,
  redactOptional,
};

export type {
  AgentProject,
  AgentSession,
  ConfigOptions,
  ExportLang,
  InternalSession,
  RecordStepInput,
  ReplaySessionOptions,
  RunOptions,
  SessionStatus,
  SessionStep,
  StepStatus,
  StepType,
  Trace,
  TraceOptions,
};

// Default export is a namespace object — handy for CJS consumers and as a
// single `import replayai from "@smazzinni/sdk"` import.
const replayai = {
  VERSION,
  trace,
  withTrace,
  recordStep,
  recordStepSync,
  configure,
  getConfig,
  resetConfig,
  currentSession,
  ReplaySession,
  flushSession,
  getLastFlushResult,
  estimateCost,
  estimateStepCost,
  redactText,
  redactOptional,
};

export default replayai;
