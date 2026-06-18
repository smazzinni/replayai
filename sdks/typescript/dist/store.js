// ReplayAI TypeScript SDK — store.
// POSTs a recorded session to the ReplayAI API. Swallows errors in non-strict
// mode so instrumented agents never break.
import { getConfig } from "./config.js";
// Module-level record of the most recent flush. Used by demos / callers that
// want the URL after `withTrace` completes (the documented `withTrace`
// signature returns the wrapped fn's value, not the session info).
let lastFlushResult = null;
export function getLastFlushResult() {
    return lastFlushResult;
}
export function _resetLastFlushResult() {
    lastFlushResult = null;
}
function buildBody(payload) {
    return {
        projectSlug: payload.project,
        name: payload.name,
        agent: payload.agent,
        framework: payload.framework,
        status: payload.status,
        startedAt: payload.startedAt.toISOString(),
        durationMs: payload.durationMs,
        tokenTotal: payload.tokenTotal,
        costUsd: payload.costUsd,
        tags: payload.tags,
        steps: payload.steps.map((s) => ({
            type: s.type,
            name: s.name,
            t: s.t ?? s.offsetMs ?? 0,
            offsetMs: s.offsetMs ?? s.t ?? 0,
            durationMs: s.durationMs ?? 0,
            status: s.status,
            model: s.model ?? undefined,
            tokensIn: s.tokensIn ?? undefined,
            tokensOut: s.tokensOut ?? undefined,
            input: s.input ?? "",
            output: s.output ?? "",
        })),
    };
}
/** POST a recorded session to `${apiUrl}/api/sessions`. */
export async function flushSession(payload) {
    const cfg = getConfig();
    const url = `${cfg.apiUrl}/api/sessions`;
    const body = buildBody(payload);
    const headers = {
        "content-type": "application/json",
        "user-agent": `@replayai/sdk ts/0.4.1`,
    };
    if (cfg.token)
        headers.authorization = `Bearer ${cfg.token}`;
    try {
        const res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const text = await res.text().catch(() => "");
            const msg = `ReplayAI flush failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`;
            if (cfg.strict)
                throw new Error(msg);
            console.warn(`[replayai] ${msg}`);
            const result = { ok: false, error: msg };
            lastFlushResult = result;
            return result;
        }
        const json = (await res.json());
        const sid = json.session?.id;
        const result = {
            ok: true,
            sessionId: sid,
            url: sid ? `${cfg.dashboardUrl}/?s=${sid}` : undefined,
        };
        lastFlushResult = result;
        return result;
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (cfg.strict)
            throw err;
        console.warn(`[replayai] flush error: ${msg}`);
        const result = { ok: false, error: msg };
        lastFlushResult = result;
        return result;
    }
}
/** GET `/api/sessions/${id}` — used by `ReplaySession.run()`. */
export async function fetchSession(sessionId) {
    const cfg = getConfig();
    const url = `${cfg.apiUrl}/api/sessions/${encodeURIComponent(sessionId)}`;
    const headers = {};
    if (cfg.token)
        headers.authorization = `Bearer ${cfg.token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        return { ok: false, status: res.status, body };
    }
    const json = await res.json();
    return { ok: true, session: json };
}
/** GET `/api/sessions/${id}/export?lang=...` — used by `ReplaySession.export()`. */
export async function fetchExport(sessionId, lang) {
    const cfg = getConfig();
    const url = `${cfg.apiUrl}/api/sessions/${encodeURIComponent(sessionId)}/export?lang=${encodeURIComponent(lang)}`;
    const headers = {};
    if (cfg.token)
        headers.authorization = `Bearer ${cfg.token}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`ReplaySession.export: GET ${url} → ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`);
    }
    return await res.text();
}
//# sourceMappingURL=store.js.map