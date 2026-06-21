// ReplayAI TypeScript SDK — ReplaySession: replay a recorded session and
// export it as a test. Wraps GET /api/sessions/:id and /export.

import { fetchExport, fetchSession } from "./store.js";
import { withTrace, currentSession } from "./context.js";
import type {
  AgentSession,
  CompareDivergence,
  CompareResult,
  ExportLang,
  MockEntry,
  MockMatchOptions,
  ReplaySessionOptions,
  RunOptions,
  SessionStatus,
  SessionStep,
  Trace,
} from "./types.js";

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
export class ReplaySession {
  readonly sessionId: string;
  readonly liveLlm: boolean;
  /** Registered mocks (pattern → canned response). Flexible matching via
   *  `MockMatchOptions`. */
  readonly mocks: MockEntry[] = [];
  /** Last loaded trace — cached for `compare()`. */
  private loadedTrace: Trace | null = null;
  /** Track which mocks have matched at least one step (for the warning). */
  private mockMatchFlags: boolean[] = [];

  constructor(sessionId: string, opts?: ReplaySessionOptions) {
    this.sessionId = sessionId;
    this.liveLlm = opts?.liveLlm ?? false;
  }

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
  mock(fnName: string, response: string | object, options?: MockMatchOptions): void {
    const respStr = typeof response === "string" ? response : JSON.stringify(response);
    const opts = options ?? {};
    let regex: RegExp | undefined;
    if (opts.isRegex) {
      try {
        regex = new RegExp(fnName);
      } catch {
        // Fall back to literal match if the regex is malformed.
        console.warn(`[replayai] mock(): invalid regex pattern "${fnName}" — falling back to literal match`);
        regex = undefined;
      }
    }
    this.mocks.push({
      pattern: fnName,
      response: respStr,
      options: opts,
      regex,
      matched: false,
    });
    this.mockMatchFlags.push(false);
  }

  /** Find the first mock matching `step`, or undefined. Marks the mock matched. */
  private findMatchingMock(step: SessionStep): MockEntry | undefined {
    const inputStr = (step.input ?? "").toLowerCase();
    for (let i = 0; i < this.mocks.length; i++) {
      const m = this.mocks[i]!;
      // Name match.
      let nameOk = true;
      if (m.options.isRegex && m.regex) {
        nameOk = m.regex.test(step.name);
      } else if (m.options.isPrefix) {
        nameOk = step.name.startsWith(m.pattern);
      } else {
        nameOk = step.name === m.pattern;
      }
      if (!nameOk) continue;

      // Input filters.
      if (m.options.inputContains !== undefined) {
        if (!inputStr.includes(m.options.inputContains.toLowerCase())) continue;
      }
      if (m.options.inputSample !== undefined) {
        const sample = inputStr.slice(0, 100);
        const expected = m.options.inputSample.toLowerCase().slice(0, 100);
        if (sample !== expected) continue;
      }

      // Matched.
      m.matched = true;
      this.mockMatchFlags[i] = true;
      return m;
    }
    return undefined;
  }

  /** Emit a warning for any registered mock that never matched a step. */
  private warnUnmatchedMocks(): void {
    for (let i = 0; i < this.mocks.length; i++) {
      if (!this.mockMatchFlags[i]) {
        const m = this.mocks[i]!;
        console.warn(
          `[replayai] mock("${m.pattern}", …) did not match any recorded step — check the pattern`,
        );
      }
    }
  }

  /**
   * Fetch the session and return a `Trace` view of it.
   *
   * The `agent`/`framework` opts are accepted for backward compatibility only;
   * a deprecation warning is emitted when supplied. The session's stored
   * agent/framework always take precedence.
   */
  async load(opts?: RunOptions): Promise<Trace> {
    if (opts && (opts.agent || opts.framework)) {
      console.warn(
        "[replayai] ReplaySession.load(): `agent` and `framework` parameters are deprecated and ignored — the recorded session's values are used",
      );
    }
    const result = await fetchSession(this.sessionId);
    if (!result.ok) {
      throw new Error(
        `ReplaySession.load: GET /api/sessions/${this.sessionId} → ${result.status} ${result.body}`,
      );
    }
    const payload = result.session as { session?: AgentSession };
    const session = payload.session;
    if (!session) {
      throw new Error(`ReplaySession.load: API response missing \`session\` field`);
    }
    const steps: SessionStep[] = session.steps ?? [];

    // Apply mocks to the loaded steps (so consumers see canned responses) and
    // mark matched mocks for the post-load warning.
    for (const step of steps) {
      const m = this.findMatchingMock(step);
      if (m) step.output = m.response;
    }
    this.warnUnmatchedMocks();

    const trace: Trace = {
      stepCount: steps.length ?? session.stepCount ?? 0,
      status: session.status as SessionStatus,
      steps,
      durationMs: session.durationMs,
      tokenTotal: session.tokenTotal,
      costUsd: session.costUsd,
      sessionId: session.id,
    };
    this.loadedTrace = trace;
    return trace;
  }

  /**
   * @deprecated Use `load()` instead. `run()` is a deprecated alias that calls
   * `load()` and emits a deprecation warning.
   */
  async run(opts?: RunOptions): Promise<Trace> {
    console.warn("[replayai] run() is deprecated, use load()");
    return this.load(opts);
  }

  /**
   * Run `agentFn(inputs)` inside a `withTrace()` context (with mocks applied
   * to recorded steps) and compare the live run against the loaded trace.
   *
   * Returns a `CompareResult` with `matches` (true iff zero divergences),
   * `stepCountLoaded`, `stepCountLive`, and a list of per-step divergences.
   *
   * If `load()` hasn't been called yet, it's called automatically.
   */
  async compare<T>(
    agentFn: (inputs?: T) => unknown | Promise<unknown>,
    inputs?: T,
  ): Promise<CompareResult> {
    const loaded = this.loadedTrace ?? (await this.load());
    const loadedSteps = loaded.steps;

    // Reset the match flags so the warning reflects THIS run.
    this.mockMatchFlags = this.mocks.map(() => false);
    for (const m of this.mocks) m.matched = false;

    // Live run with mock interception: install an "interceptor" via a closure
    // that wraps recordStep. We can't monkey-patch the user's agentFn, but we
    // can run it inside withTrace and inspect steps after the fact — and
    // re-apply mocks to live-recorded steps so the comparison is apples-to-
    // apples with the loaded (mocked) trace.
    let liveSession = currentSession();
    await withTrace(
      `${this.sessionId}-compare`,
      { tags: ["compare"], sampleRate: 0 }, // never flush a compare run
      async () => {
        liveSession = currentSession();
        await agentFn(inputs);
      },
    );

    const liveSteps = liveSession?.steps ?? [];
    // Apply mocks to the live steps (canned outputs) and flag matched mocks.
    for (const step of liveSteps) {
      const m = this.findMatchingMock(step);
      if (m) step.output = m.response;
    }
    this.warnUnmatchedMocks();

    // Compute divergences.
    const divergences: CompareDivergence[] = [];
    const maxLen = Math.max(loadedSteps.length, liveSteps.length);
    for (let i = 0; i < maxLen; i++) {
      const lStep = loadedSteps[i];
      const rStep = liveSteps[i];
      if (!lStep || !rStep) {
        divergences.push({
          step: i,
          field: "presence",
          loaded: lStep ? "present" : "missing",
          live: rStep ? "present" : "missing",
        });
        continue;
      }
      for (const field of ["name", "type", "status", "output"] as const) {
        const lv = lStep[field];
        const rv = rStep[field];
        if (lv !== rv) {
          divergences.push({
            step: i,
            field,
            loaded: lv,
            live: rv,
          });
        }
      }
    }

    return {
      matches: divergences.length === 0,
      stepCountLoaded: loadedSteps.length,
      stepCountLive: liveSteps.length,
      divergences,
    };
  }

  /** Fetch the session exported as a pytest or jest test source string. */
  async export(lang: ExportLang = "pytest"): Promise<string> {
    return fetchExport(this.sessionId, lang);
  }
}
