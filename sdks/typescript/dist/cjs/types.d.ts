export type StepType = "llm_call" | "tool_call" | "retrieval" | "decision" | "error";
export type StepStatus = "success" | "failed" | "running" | "warning";
export type SessionStatus = "success" | "failed" | "running";
/** A single recorded step inside a session. Mirrors the API's SessionStep. */
export interface SessionStep {
    id?: string;
    type: StepType;
    name: string;
    /** ms offset from session start (alias of offsetMs) */
    t?: number;
    offsetMs?: number;
    durationMs?: number;
    status: StepStatus;
    model?: string | null;
    tokensIn?: number | null;
    tokensOut?: number | null;
    input?: string;
    output?: string;
}
/** A full agent session as returned by the API. */
export interface AgentSession {
    id: string;
    projectId?: string;
    name: string;
    agent: string;
    framework: string;
    status: SessionStatus;
    startedAt: string;
    durationMs: number;
    tokenTotal: number;
    costUsd: number;
    tags: string[];
    steps: SessionStep[];
    /** Present on list responses. */
    stepCount?: number;
    /** Present when joined with project on the detail endpoint. */
    project?: AgentProject;
}
export interface AgentProject {
    id: string;
    name: string;
    slug: string;
    framework: string;
    description?: string | null;
    createdAt: string;
    sessionCount?: number;
}
/** Options accepted by `trace()` and `withTrace()`. */
export interface TraceOptions {
    /** Project slug or id. Falls back to REPLAYAI_PROJECT env var. */
    project?: string;
    tags?: string[];
    framework?: string;
    startedAt?: Date;
    /** Agent name (defaults to the trace name). */
    agent?: string;
    /** Per-call override of the sample rate (0.0–1.0). */
    sampleRate?: number;
    /** When true, skip all persistence (cloud + local). Used internally by
     *  `compare()` to avoid polluting the session store with comparison runs. */
    skipFlush?: boolean;
    /** When true and there's an active trace, append steps to the existing
     *  session instead of creating a new one. Use this to group multiple
     *  decorated calls into one logical session. */
    inherit?: boolean;
}
/** Lightweight view of a recorded/replayed trace. */
export interface Trace {
    stepCount: number;
    status: SessionStatus;
    steps: SessionStep[];
    durationMs?: number;
    tokenTotal?: number;
    costUsd?: number;
    sessionId?: string;
    sessionUrl?: string;
}
export interface ReplaySessionOptions {
    liveLlm?: boolean;
}
export interface RunOptions {
    agent: string;
    framework?: string;
}
/**
 * Options for flexible mock matching in `ReplaySession.mock()`.
 * Defaults to exact-name match. Combine flags for AND-style filtering.
 */
export interface MockMatchOptions {
    /** Match if the step name starts with `fnName`. */
    isPrefix?: boolean;
    /** Treat `fnName` as a regex pattern (matched against the step name). */
    isRegex?: boolean;
    /** Case-insensitive substring check against the step's input. */
    inputContains?: string;
    /** Case-insensitive equality against the first 100 chars of step input. */
    inputSample?: string;
}
/** Internal representation of a registered mock. */
export interface MockEntry {
    /** Original `fnName` argument (name, prefix, or regex source). */
    pattern: string;
    /** Canned response (JSON string). */
    response: string;
    options: MockMatchOptions;
    /** Compiled regex (when `isRegex` is set). */
    regex?: RegExp;
    /** Set true once matched against at least one step — used for the "no match" warning. */
    matched?: boolean;
}
/** Single divergence between a loaded trace and a live compare run. */
export interface CompareDivergence {
    step: number;
    field: string;
    loaded: unknown;
    live: unknown;
}
/** Result of `ReplaySession.compare()`. */
export interface CompareResult {
    matches: boolean;
    stepCountLoaded: number;
    stepCountLive: number;
    divergences: CompareDivergence[];
}
/** A single parsed frame from an error stack trace. */
export interface StackFrame {
    file?: string;
    line?: number;
    column?: number;
    function?: string;
}
/** Structured representation of an exception captured inside `withTrace()`. */
export interface CapturedException {
    name: string;
    message: string;
    stackFrames: StackFrame[];
    rawStack: string;
    extractionFailed: boolean;
}
export interface RecordStepInput {
    type?: StepType;
    name: string;
    model?: string | null;
    tokensIn?: number;
    tokensOut?: number;
    input?: unknown;
    output?: unknown;
    status?: StepStatus;
    /** ms offset from session start; inferred if omitted. */
    offsetMs?: number;
    /** alias for offsetMs */
    t?: number;
    durationMs?: number;
}
export interface ConfigOptions {
    project?: string;
    token?: string;
    storage?: "local" | "cloud" | "both";
    storagePath?: string;
    apiUrl?: string;
    dashboardUrl?: string;
    sampleRate?: number;
    strict?: boolean;
    redactPatterns?: Array<string | RegExp>;
    /** Per-request timeout in ms (default 30000). */
    timeoutMs?: number;
    /** Max steps to retain per session before truncation (default 200). */
    maxSteps?: number;
    /** When false, entropy-based redaction is disabled (default true). */
    redactStrict?: boolean;
}
/** Result of `flushSession()` — duplicated here (structurally) to avoid a
 *  circular type import between types.ts and store.ts. */
export interface LastFlushResult {
    ok: boolean;
    sessionId?: string;
    url?: string;
    error?: string;
    truncated?: boolean;
    queued?: boolean;
}
/**
 * Internal representation of a session being recorded. Populated by
 * `withTrace()`/`trace()` and flushed by `store.flushSession()`.
 */
export interface InternalSession {
    id: string;
    name: string;
    agent: string;
    project?: string;
    framework: string;
    tags: string[];
    startedAt: Date;
    /** wall-clock ms captured on enter — used for offset inference */
    __startMs: number;
    steps: SessionStep[];
    status: SessionStatus;
    /** True when the session was selected by the sampler (will be flushed). */
    __sampled?: boolean;
    /** Set by `endAndFlush` after the POST completes. Lets consumers capture the
     *  session via `currentSession()` inside `withTrace` and read the URL afterward. */
    __flushResult?: LastFlushResult;
    error?: unknown;
    endAt?: Date;
}
export type ExportLang = "pytest" | "jest";
//# sourceMappingURL=types.d.ts.map