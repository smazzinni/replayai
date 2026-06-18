import type { ExportLang, ReplaySessionOptions, RunOptions, Trace } from "./types.js";
/**
 * ReplaySession — load a previously-recorded session from the API and either
 * re-run it (returning a `Trace`) or export it as a pytest/jest test.
 *
 * ```ts
 * const replay = new ReplaySession("ses_8fa1", { liveLlm: false });
 * replay.mock("issue_refund", JSON.stringify({ refund_id: "ref_3391" }));
 * const trace = await replay.run({ agent: "support-agent-v3", framework: "LangChain" });
 * console.log(trace.stepCount, trace.status);
 * const code = await replay.export("pytest");
 * ```
 */
export declare class ReplaySession {
    readonly sessionId: string;
    readonly liveLlm: boolean;
    /** fnName → canned response (JSON string). */
    readonly mocks: Record<string, string>;
    constructor(sessionId: string, opts?: ReplaySessionOptions);
    /** Register a canned response for a mocked function call. */
    mock(fnName: string, response: string | object): void;
    /**
     * Fetch the session and return a `Trace` view of it.
     *
     * The `agent`/`framework` opts are accepted for API parity with the Python
     * SDK; the session's stored agent/framework take precedence.
     */
    run(opts: RunOptions): Promise<Trace>;
    /** Fetch the session exported as a pytest or jest test source string. */
    export(lang?: ExportLang): Promise<string>;
}
//# sourceMappingURL=session.d.ts.map