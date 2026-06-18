"use strict";
// ReplayAI TypeScript SDK — ReplaySession: replay a recorded session and
// export it as a test. Wraps GET /api/sessions/:id and /export.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplaySession = void 0;
const store_js_1 = require("./store.js");
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
class ReplaySession {
    sessionId;
    liveLlm;
    /** fnName → canned response (JSON string). */
    mocks = {};
    constructor(sessionId, opts) {
        this.sessionId = sessionId;
        this.liveLlm = opts?.liveLlm ?? false;
    }
    /** Register a canned response for a mocked function call. */
    mock(fnName, response) {
        this.mocks[fnName] = typeof response === "string" ? response : JSON.stringify(response);
    }
    /**
     * Fetch the session and return a `Trace` view of it.
     *
     * The `agent`/`framework` opts are accepted for API parity with the Python
     * SDK; the session's stored agent/framework take precedence.
     */
    async run(opts) {
        const result = await (0, store_js_1.fetchSession)(this.sessionId);
        if (!result.ok) {
            throw new Error(`ReplaySession.run: GET /api/sessions/${this.sessionId} → ${result.status} ${result.body}`);
        }
        const payload = result.session;
        const session = payload.session;
        if (!session) {
            throw new Error(`ReplaySession.run: API response missing \`session\` field`);
        }
        const steps = session.steps ?? [];
        return {
            stepCount: steps.length ?? session.stepCount ?? 0,
            status: session.status,
            steps,
            durationMs: session.durationMs,
            tokenTotal: session.tokenTotal,
            costUsd: session.costUsd,
            sessionId: session.id,
        };
    }
    /** Fetch the session exported as a pytest or jest test source string. */
    async export(lang = "pytest") {
        return (0, store_js_1.fetchExport)(this.sessionId, lang);
    }
}
exports.ReplaySession = ReplaySession;
//# sourceMappingURL=session.js.map