import type { CompareResult, ExportLang, MockEntry, MockMatchOptions, ReplaySessionOptions, RunOptions, Trace } from "./types.js";
/**
 * ReplaySession — load a previously-recorded session from the API and either
 * re-run it (returning a `Trace`), compare a live run against it, or export it
 * as a pytest/jest test.
 *
 * ```ts
 * const replay = new ReplaySession("ses_8fa1", { liveLlm: false });
 * replay.mock("issue_refund", JSON.stringify({ refund_id: "ref_3391" }));
 * const trace = await replay.load();
 * console.log(trace.stepCount, trace.status);
 * const code = await replay.export("pytest");
 * ```
 */
export declare class ReplaySession {
    readonly sessionId: string;
    readonly liveLlm: boolean;
    /** Registered mocks (pattern → canned response). Flexible matching via
     *  `MockMatchOptions`. */
    readonly mocks: MockEntry[];
    /** Last loaded trace — cached for `compare()`. */
    private loadedTrace;
    /** Track which mocks have matched at least one step (for the warning). */
    private mockMatchFlags;
    constructor(sessionId: string, opts?: ReplaySessionOptions);
    /**
     * Register a canned response for a mocked function call.
     *
     * Matching modes (defaults to exact name match):
     *  - Exact: `mock("tool_name", response)`
     *  - Prefix: `mock("search", response, { isPrefix: true })`
     *  - Regex: `mock("search_web.*", response, { isRegex: true })`
     *  - Input-contains: `mock("tool", response, { inputContains: "NYC" })` (case-insensitive)
     *  - Input-exact: `mock("tool", response, { inputSample: "expected" })` (first 100 chars, case-insensitive)
     *
     * Multiple flags AND together. A warning is emitted when a registered mock
     * matches no step during `load()` or `compare()`.
     */
    mock(fnName: string, response: string | object, options?: MockMatchOptions): void;
    /** Find the first mock matching `step`, or undefined. Marks the mock matched. */
    private findMatchingMock;
    /** Emit a warning for any registered mock that never matched a step. */
    private warnUnmatchedMocks;
    /**
     * Fetch the session and return a `Trace` view of it.
     *
     * The `agent`/`framework` opts are accepted for backward compatibility only;
     * a deprecation warning is emitted when supplied. The session's stored
     * agent/framework always take precedence.
     */
    load(opts?: RunOptions): Promise<Trace>;
    /**
     * @deprecated Use `load()` instead. `run()` is a deprecated alias that calls
     * `load()` and emits a deprecation warning.
     */
    run(opts?: RunOptions): Promise<Trace>;
    /**
     * Run `agentFn(inputs)` inside a `withTrace()` context (with mocks applied
     * to recorded steps) and compare the live run against the loaded trace.
     *
     * Returns a `CompareResult` with `matches` (true iff zero divergences),
     * `stepCountLoaded`, `stepCountLive`, and a list of per-step divergences.
     *
     * If `load()` hasn't been called yet, it's called automatically.
     */
    compare<T>(agentFn: (inputs?: T) => unknown | Promise<unknown>, inputs?: T): Promise<CompareResult>;
    /** Fetch the session exported as a pytest or jest test source string. */
    export(lang?: ExportLang): Promise<string>;
}
//# sourceMappingURL=session.d.ts.map