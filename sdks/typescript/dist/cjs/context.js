"use strict";
// ReplayAI TypeScript SDK — context.
// AsyncLocalStorage-based current-session tracking. `withTrace()` is the
// context manager; `trace()` is the higher-order wrapper.
//
// Always enters the AsyncLocalStorage run — even when not sampled — so that
// recordStep() can still attach steps to a (non-flushed) session. The sampler
// only gates the POST to the API (errors always flush).
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentSession = currentSession;
exports.isSampled = isSampled;
exports.appendStep = appendStep;
exports.parseStackTrace = parseStackTrace;
exports.withTrace = withTrace;
exports.trace = trace;
const node_async_hooks_1 = require("node:async_hooks");
const node_crypto_1 = require("node:crypto");
const config_js_1 = require("./config.js");
const cost_js_1 = require("./cost.js");
const store_js_1 = require("./store.js");
const storage = new node_async_hooks_1.AsyncLocalStorage();
/** Return the innermost active recording session, if any. */
function currentSession() {
    return storage.getStore();
}
/** True iff the current context is sampled (will be flushed to the API). */
function isSampled() {
    const s = storage.getStore();
    return !!s?.__sampled;
}
function nowMs() {
    return Date.now();
}
function shouldSample(rate) {
    if (rate >= 1)
        return true;
    if (rate <= 0)
        return false;
    return Math.random() < rate;
}
function startSession(name, opts, sampled) {
    const cfg = (0, config_js_1.getConfig)();
    const startedAt = opts?.startedAt ?? new Date();
    return {
        id: (0, node_crypto_1.randomUUID)(),
        name,
        agent: opts?.agent ?? name,
        project: opts?.project ?? cfg.project,
        framework: opts?.framework ?? "Custom",
        tags: opts?.tags ? [...opts.tags] : [],
        startedAt,
        __startMs: startedAt.getTime(),
        __sampled: sampled,
        steps: [],
        status: "running",
    };
}
/** Append a normalized step to the current session. Warns (no-op) if no
 *  session is active so users learn to wrap their code in `withTrace()`. */
function appendStep(step) {
    const s = currentSession();
    if (!s) {
        console.warn("[replayai] recordStep() called outside of an active trace — step was not recorded");
        return;
    }
    // Infer offset from session start if missing.
    if (step.t === undefined && step.offsetMs === undefined) {
        step.t = Math.max(0, nowMs() - s.__startMs);
    }
    if (step.offsetMs === undefined && step.t !== undefined)
        step.offsetMs = step.t;
    if (step.t === undefined && step.offsetMs !== undefined)
        step.t = step.offsetMs;
    if (step.durationMs === undefined)
        step.durationMs = 0;
    s.steps.push(step);
}
// ---- Structured exception capture -----------------------------------------
/**
 * Parse a V8-style stack trace string into structured frames. Best-effort —
 * sets `extractionFailed: true` (via the caller) on any throw. Each frame:
 *   { file?, line?, column?, function? }
 *
 * Handles lines like:
 *   "    at foo (/path/file.js:10:20)"
 *   "    at /path/file.js:10:20"
 *   "    at Object.<anonymous> (/path/file.js:5:1)"
 *   "    at Module._compile (node:internal/modules/cjs/loader:999:30)"
 */
function parseStackTrace(stack) {
    if (!stack)
        return [];
    const frames = [];
    // Lines look like: "    at FUNC (FILE:LINE:COL)" or "    at FILE:LINE:COL"
    const re = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?\s*$/;
    for (const line of stack.split("\n")) {
        const m = re.exec(line);
        if (!m)
            continue;
        const fn = m[1] || undefined;
        const file = m[2] || undefined;
        const ln = m[3] ? parseInt(m[3], 10) : undefined;
        const col = m[4] ? parseInt(m[4], 10) : undefined;
        frames.push({ function: fn, file, line: ln, column: col });
    }
    return frames;
}
/** Build the structured exception record, never throwing. */
function captureException(err) {
    const name = err instanceof Error ? err.name : typeof err === "string" ? "Error" : "UnknownError";
    const message = err instanceof Error ? err.message : String(err);
    const rawStack = err instanceof Error && err.stack ? err.stack : "";
    let stackFrames = [];
    let extractionFailed = false;
    try {
        stackFrames = parseStackTrace(rawStack);
    }
    catch {
        extractionFailed = true;
        stackFrames = [];
    }
    if (!extractionFailed && rawStack && stackFrames.length === 0) {
        // Not a parse failure per se, but mark so consumers know frames are empty.
        // Keep `extractionFailed: false` — we successfully parsed, there was just
        // nothing to extract.
    }
    return { name, message, stackFrames, rawStack, extractionFailed };
}
/** Compute final totals + status and POST the session to the API. */
async function endAndFlush(session) {
    session.endAt = new Date();
    const wallClockDuration = session.endAt.getTime() - session.startedAt.getTime();
    // Session duration = max(wall-clock, latest step end).
    let stepEndMax = 0;
    for (const s of session.steps) {
        const t = s.offsetMs ?? s.t ?? 0;
        const d = s.durationMs ?? 0;
        stepEndMax = Math.max(stepEndMax, t + d);
    }
    const durationMs = Math.max(wallClockDuration, stepEndMax);
    // Derive status.
    let status = session.status;
    if (session.error !== undefined) {
        status = "failed";
    }
    else if (session.steps.some((s) => s.status === "failed")) {
        status = "failed";
    }
    else {
        status = "success";
    }
    const tokenTotal = session.steps.reduce((a, s) => a + (s.tokensIn ?? 0) + (s.tokensOut ?? 0), 0);
    const costUsd = (0, cost_js_1.estimateCost)(session.steps);
    // If an exception was captured, append a structured error step BEFORE flush
    // so the dashboard can render stack frames + raw stack.
    if (session.error !== undefined) {
        const ex = captureException(session.error);
        const errStep = {
            type: "error",
            name: ex.name || "Error",
            status: "failed",
            t: Math.max(0, wallClockDuration),
            offsetMs: Math.max(0, wallClockDuration),
            durationMs: 0,
            input: ex.message,
            output: JSON.stringify(ex),
        };
        session.steps.push(errStep);
    }
    const flushPayload = {
        sessionId: session.id,
        name: session.name,
        agent: session.agent,
        project: session.project,
        framework: session.framework,
        tags: session.tags,
        startedAt: session.startedAt,
        durationMs,
        status,
        tokenTotal,
        costUsd,
        steps: session.steps,
    };
    // Local persistence — write to disk when storage includes "local".
    const cfg = (0, config_js_1.getConfig)();
    let localId;
    if (cfg.storage === "local" || cfg.storage === "both") {
        try {
            const { saveSession } = await Promise.resolve().then(() => __importStar(require("./local-store.js")));
            localId = saveSession(flushPayload);
        }
        catch (e) {
            const m = e instanceof Error ? e.message : String(e);
            if (cfg.strict)
                throw new Error(`ReplayAI local persist failed: ${m}`);
            console.warn(`[replayai] local persist failed: ${m}`);
        }
    }
    // Cloud persistence — POST to the API when storage includes "cloud".
    if (cfg.storage === "cloud" || cfg.storage === "both") {
        return (0, store_js_1.flushSession)(flushPayload).then((result) => {
            session.__flushResult = result;
            return result;
        });
    }
    // Local-only: synthesize a success result with the local id + dashboard url.
    const localResult = {
        ok: true,
        sessionId: localId,
        url: localId ? `${cfg.dashboardUrl}/?s=${localId}` : undefined,
    };
    session.__flushResult = localResult;
    return localResult;
}
/**
 * `withTrace` — async context manager. Wraps a function body in a recorded
 * session; on exit computes duration/tokens/cost/status and POSTs to the API.
 *
 * Always enters the AsyncLocalStorage run — even when not sampled — so that
 * recordStep() still has a session to attach to. Only the API flush is gated
 * by the sampler (errors always flush regardless of sampling).
 *
 * Errors from the wrapped function are re-thrown as-is; recording failures
 * are swallowed unless `strict` mode is on.
 */
async function withTrace(name, opts, fn) {
    const cfg = (0, config_js_1.getConfig)();
    const rate = opts?.sampleRate ?? cfg.sampleRate;
    const sampled = shouldSample(rate);
    const session = startSession(name, opts, sampled);
    return await storage.run(session, async () => {
        let result;
        try {
            result = await fn();
            if (session.status === "running")
                session.status = "success";
        }
        catch (err) {
            session.status = "failed";
            session.error = err;
            // Errors always flush, even when not sampled.
            try {
                await endAndFlush(session);
            }
            catch (flushErr) {
                if (cfg.strict)
                    throw flushErr;
            }
            throw err;
        }
        // Success path: flush if sampled (cloud) OR if local storage is enabled
        // (so locally-recorded sessions always persist regardless of sample rate).
        const shouldFlush = session.__sampled || cfg.storage === "local" || cfg.storage === "both";
        if (shouldFlush) {
            try {
                await endAndFlush(session);
            }
            catch (flushErr) {
                if (cfg.strict)
                    throw flushErr;
            }
        }
        return result;
    });
}
/** `trace` — higher-order function. Returns a wrapped fn with the same signature. */
function trace(name, opts, fn) {
    const wrapped = (...args) => {
        return withTrace(name, opts, () => fn(...args));
    };
    // Preserve name/length for nicer stack traces / introspection.
    Object.defineProperty(wrapped, "name", { value: fn.name || "trace", configurable: true });
    return wrapped;
}
//# sourceMappingURL=context.js.map