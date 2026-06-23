// ReplayAI TypeScript SDK — store.
// POSTs a recorded session to the ReplayAI API with timeout, retry+backoff,
// an in-memory retry queue, and payload-size truncation. Errors are swallowed
// in non-strict mode so instrumented agents never break.

import { randomUUID } from "node:crypto";
import { getConfig } from "./config.js";
import type { SessionStatus, SessionStep } from "./types.js";

/** SDK version (mirrored from index.ts — kept here to avoid a circular import
 *  just for the user-agent string). */
const SDK_VERSION = "0.7.2";

export interface FlushPayload {
  /** Local correlation id (UUIDv4); the API assigns the canonical id. */
  sessionId: string;
  name: string;
  agent: string;
  project?: string;
  framework: string;
  tags: string[];
  startedAt: Date;
  durationMs: number;
  status: SessionStatus;
  tokenTotal: number;
  costUsd: number;
  steps: SessionStep[];
}

export interface FlushResult {
  ok: boolean;
  sessionId?: string;
  url?: string;
  error?: string;
  /** True when the payload was truncated before flush. */
  truncated?: boolean;
  /** True when the payload was placed on the retry queue instead of being delivered. */
  queued?: boolean;
}

// ---- In-memory retry queue -------------------------------------------------

const QUEUE_MAX = 100;
const queue: FlushPayload[] = [];

function enqueuePayload(payload: FlushPayload): boolean {
  if (queue.length >= QUEUE_MAX) {
    console.warn(
      `[replayai] retry queue full (${QUEUE_MAX}); payload for session ${payload.sessionId} dropped`,
    );
    return false;
  }
  queue.push(payload);
  return true;
}

/** Drain the in-memory retry queue. Called before every fresh flush so older
 *  failed payloads get re-sent first. Returns the count successfully drained. */
async function drainQueue(): Promise<number> {
  let drained = 0;
  while (queue.length > 0) {
    const next = queue[0]!;
    const result = await flushOnce(next);
    if (result.ok) {
      queue.shift();
      drained++;
    } else {
      // Stop at the first failure — keep the rest queued, in order.
      break;
    }
  }
  return drained;
}

// ---- Payload size check + truncation --------------------------------------

const PAYLOAD_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

function byteLength(s: string): number {
  return Buffer.byteLength(s, "utf8");
}

function buildBody(payload: FlushPayload) {
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

/**
 * Truncate `payload.steps` to keep first 50 + last 50 + all error steps when
 * the payload exceeds the configured `maxSteps` or its serialized JSON exceeds
 * 5 MB. Returns true when truncation was applied. Mutates `payload` in place.
 */
function maybeTruncate(payload: FlushPayload, maxSteps: number): boolean {
  let truncated = false;

  // Step-count cap (config.maxSteps).
  if (payload.steps.length > maxSteps) {
    payload.steps = truncateSteps(payload.steps, 50, 50);
    truncated = true;
  }

  // Hard 5 MB size cap — keep shrinking the head/tail window until under.
  let headTail = 50;
  while (byteLength(JSON.stringify(buildBody(payload))) > PAYLOAD_MAX_BYTES) {
    if (headTail <= 0) {
      // Last resort: drop everything but errors and a single sentinel step.
      payload.steps = payload.steps.filter((s) => s.status === "failed");
      truncated = true;
      break;
    }
    payload.steps = truncateSteps(payload.steps, headTail, headTail);
    truncated = true;
    headTail = Math.floor(headTail / 2);
  }

  return truncated;
}

function truncateSteps(steps: SessionStep[], head: number, tail: number): SessionStep[] {
  const errors = steps.filter((s) => s.status === "failed");
  if (steps.length <= head + tail) return steps;
  const first = steps.slice(0, head);
  const last = steps.slice(steps.length - tail);
  // De-dupe: errors captured by `first`/`last` shouldn't be repeated.
  const seen = new Set<string>();
  for (const s of [...first, ...last]) {
    if (s.id) seen.add(s.id);
    else seen.add(`${s.name}|${s.t ?? s.offsetMs ?? 0}`);
  }
  const extra = errors.filter((s) => {
    const k = s.id ? s.id : `${s.name}|${s.t ?? s.offsetMs ?? 0}`;
    return !seen.has(k);
  });
  const out: SessionStep[] = [...first, ...extra, ...last];
  return out;
}

// ---- Retry with exponential backoff ---------------------------------------

const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 10000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 && status < 600;
}

/**
 * Attempt a single POST (with AbortController timeout). Throws on network /
 * abort / retryable-5xx errors so the retry loop can catch them. Returns the
 * parsed FlushResult on success or a non-retryable failure (4xx).
 */
async function flushOnce(payload: FlushPayload): Promise<FlushResult> {
  const cfg = getConfig();
  const url = `${cfg.apiUrl}/api/sessions`;
  const body = buildBody(payload);
  const bodyStr = JSON.stringify(body);

  const headers: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": `@smazzinni/sdk ts/${SDK_VERSION}`,
  };
  if (cfg.token) headers.authorization = `Bearer ${cfg.token}`;

  const controller = new AbortController();
  const timeoutMs = cfg.timeoutMs > 0 ? cfg.timeoutMs : 30000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: bodyStr,
      signal: controller.signal,
    });
  } catch (err) {
    // Re-throw so the retry loop can decide. AbortError (timeout) and network
    // errors are retryable.
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const msg = `ReplayAI flush failed: ${res.status} ${res.statusText}${text ? ` — ${text}` : ""}`;
    if (isRetryableStatus(res.status)) {
      // Retryable: throw so the loop catches it.
      throw new Error(msg);
    }
    // Non-retryable (4xx, etc.): return failure directly.
    if (cfg.strict) throw new Error(msg);
    console.warn(`[replayai] ${msg}`);
    return { ok: false, error: msg };
  }

  const json = (await res.json()) as { session?: { id?: string } };
  const sid = json.session?.id;
  return {
    ok: true,
    sessionId: sid,
    url: sid ? `${cfg.dashboardUrl}/?s=${sid}` : undefined,
  };
}

/**
 * POST a recorded session to `${apiUrl}/api/sessions` with timeout, retry, and
 * in-memory queue fallback. Drains any queued payloads first. Returns the
 * result of the *new* flush (queued payloads are best-effort and don't affect
 * the caller's view unless the new payload itself was queued).
 */
export async function flushSession(payload: FlushPayload): Promise<FlushResult> {
  const cfg = getConfig();

  // Truncate before any network activity.
  const truncated = maybeTruncate(payload, cfg.maxSteps);
  if (truncated) {
    console.warn(
      `[replayai] payload for session ${payload.sessionId} exceeded limits — steps truncated (kept first 50 + last 50 + errors)`,
    );
  }

  // Drain the queue first — older failures get priority.
  try {
    await drainQueue();
  } catch (queuedErr) {
    // Drain failures shouldn't block the new flush; just warn.
    const m = queuedErr instanceof Error ? queuedErr.message : String(queuedErr);
    console.warn(`[replayai] queue drain error: ${m}`);
  }

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      const result = await flushOnce(payload);
      // Success or non-retryable failure — return as-is (with truncated flag).
      return { ...result, truncated: truncated || undefined };
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_MAX_ATTEMPTS) {
        const backoff = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS);
        const m = err instanceof Error ? err.message : String(err);
        console.warn(
          `[replayai] flush attempt ${attempt}/${RETRY_MAX_ATTEMPTS} failed (${m}); retrying in ${backoff}ms`,
        );
        await sleep(backoff);
      }
    }
  }

  // All retries exhausted → push to the in-memory queue.
  const m = lastErr instanceof Error ? lastErr.message : String(lastErr);
  const queued = enqueuePayload(payload);
  if (cfg.strict) {
    throw new Error(
      `ReplayAI flush failed after ${RETRY_MAX_ATTEMPTS} attempts: ${m}${queued ? " (payload queued for retry)" : " (queue full — payload dropped)"}`,
    );
  }
  console.warn(
    `[replayai] flush failed after ${RETRY_MAX_ATTEMPTS} attempts: ${m}${queued ? " (payload queued for retry)" : " (queue full — payload dropped)"}`,
  );
  return {
    ok: false,
    error: m,
    truncated: truncated || undefined,
    queued: queued || undefined,
  };
}

/** GET `/api/sessions/${id}` — used by `ReplaySession.load()`. Includes timeout
 *  + retry for parity with `flushSession`. */
export async function fetchSession(
  sessionId: string,
): Promise<{ ok: true; session: unknown } | { ok: false; status: number; body: string }> {
  const cfg = getConfig();
  const url = `${cfg.apiUrl}/api/sessions/${encodeURIComponent(sessionId)}`;
  const headers: Record<string, string> = {};
  if (cfg.token) headers.authorization = `Bearer ${cfg.token}`;

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutMs = cfg.timeoutMs > 0 ? cfg.timeoutMs : 30000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        if (isRetryableStatus(res.status) && attempt < RETRY_MAX_ATTEMPTS) {
          lastErr = new Error(`GET ${url} → ${res.status}`);
          await sleep(Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS));
          continue;
        }
        return { ok: false, status: res.status, body };
      }
      const json = await res.json();
      return { ok: true, session: json };
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_MAX_ATTEMPTS) {
        await sleep(Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  const m = lastErr instanceof Error ? lastErr.message : String(lastErr);
  return { ok: false, status: 0, body: m };
}

/** GET `/api/sessions/${id}/export?lang=...` — used by `ReplaySession.export()`.
 *  Includes timeout + retry. */
export async function fetchExport(
  sessionId: string,
  lang: "pytest" | "jest",
): Promise<string> {
  const cfg = getConfig();
  const url = `${cfg.apiUrl}/api/sessions/${encodeURIComponent(sessionId)}/export?lang=${encodeURIComponent(lang)}`;
  const headers: Record<string, string> = {};
  if (cfg.token) headers.authorization = `Bearer ${cfg.token}`;

  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeoutMs = cfg.timeoutMs > 0 ? cfg.timeoutMs : 30000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: controller.signal });
      if (res.ok) return await res.text();
      const body = await res.text().catch(() => "");
      if (isRetryableStatus(res.status) && attempt < RETRY_MAX_ATTEMPTS) {
        lastErr = new Error(`GET ${url} → ${res.status} ${res.statusText}`);
        await sleep(Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS));
        continue;
      }
      throw new Error(
        `ReplaySession.export: GET ${url} → ${res.status} ${res.statusText}${body ? ` — ${body}` : ""}`,
      );
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_MAX_ATTEMPTS) {
        await sleep(Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), RETRY_MAX_MS));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  const m = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`ReplaySession.export: GET ${url} failed after ${RETRY_MAX_ATTEMPTS} attempts: ${m}`);
}

/** Internal helper for tests: peek at the current queue length. */
export function _queueLength(): number {
  return queue.length;
}

/** Internal helper for tests: clear the queue. */
export function _clearQueue(): void {
  queue.length = 0;
}

/** Generate a fresh local correlation id (UUIDv4). */
export function newLocalSessionId(): string {
  return randomUUID();
}
