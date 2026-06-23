// ReplayAI TypeScript SDK — configuration.
// Reads env vars on first access; `configure()` overrides programmatically.

import type { ConfigOptions } from "./types.js";

/** Default redaction patterns. Applied to every step's input/output. */
export const DEFAULT_REDACT_PATTERNS: RegExp[] = [
  // OpenAI-style API keys (legacy + project + service-account + admin prefixes).
  /sk-(?:proj|svcacct|admin)?-?[a-zA-Z0-9]{20,}/g,
  /Bearer\s+[a-zA-Z0-9._\-]+/g, // Authorization header tokens
  /password=[^\s&]+/gi, // password=... in URLs / form bodies
  /["']?api[_-]?key["']?\s*[:=]\s*["']?[a-zA-Z0-9]{20,}/gi, // api_key=...
];

export type StorageMode = "local" | "cloud" | "both";

export interface ResolvedConfig {
  project?: string;
  token?: string;
  storage: StorageMode;
  storagePath: string;
  apiUrl: string;
  dashboardUrl: string;
  sampleRate: number;
  strict: boolean;
  redactPatterns: RegExp[];
  /** Per-request timeout in ms. Default 30000. */
  timeoutMs: number;
  /** Max steps retained per session before truncation. Default 200. */
  maxSteps: number;
  /** When false, entropy-based redaction is disabled. Default true. */
  redactStrict: boolean;
}

function envString(name: string, fallback?: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
}

function envNumber(name: string, fallback: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "1" || v.toLowerCase() === "true" || v.toLowerCase() === "yes" || v.toLowerCase() === "on";
}

function parseRedactPatterns(raw: string | undefined): RegExp[] | null {
  if (!raw || raw.trim() === "") return null;
  const out: RegExp[] = [];
  for (const piece of raw.split(",")) {
    const p = piece.trim();
    if (!p) continue;
    try {
      out.push(new RegExp(p, "g"));
    } catch {
      // If the user supplied a malformed regex, escape it and try again.
      const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      try {
        out.push(new RegExp(escaped, "g"));
      } catch {
        /* skip unparseable */
      }
    }
  }
  return out.length > 0 ? out : null;
}

let cached: ResolvedConfig | null = null;
let overrides: ConfigOptions = {};

/** Resolve the active config from env vars + programmatic overrides. */
export function resolveConfig(): ResolvedConfig {
  if (cached) return cached;

  const storageRaw = overrides.storage ?? envString("REPLAYAI_STORAGE") ?? "local";
  const storage: StorageMode =
    storageRaw === "local" || storageRaw === "cloud" || storageRaw === "both"
      ? storageRaw
      : "local";

  let redactPatterns: RegExp[] | null = null;
  if (overrides.redactPatterns) {
    redactPatterns = overrides.redactPatterns.map((p) =>
      typeof p === "string" ? safeRegex(p) : p,
    );
  } else {
    redactPatterns = parseRedactPatterns(envString("REPLAYAI_REDACT_PATTERNS"));
  }

  cached = {
    project: overrides.project ?? envString("REPLAYAI_PROJECT"),
    token: overrides.token ?? envString("REPLAYAI_TOKEN"),
    storage,
    storagePath: overrides.storagePath ?? envString("REPLAYAI_STORAGE_PATH") ?? "./ReplayAI",
    apiUrl: (overrides.apiUrl ?? envString("REPLAYAI_API_URL") ?? "http://localhost:3000").replace(/\/$/, ""),
    dashboardUrl: overrides.dashboardUrl ?? envString("REPLAYAI_DASHBOARD_URL") ?? "http://localhost:3000",
    sampleRate: overrides.sampleRate ?? envNumber("REPLAYAI_SAMPLE_RATE", 1.0),
    strict: overrides.strict ?? envBool("REPLAYAI_STRICT", false),
    redactPatterns: redactPatterns ?? [...DEFAULT_REDACT_PATTERNS],
    timeoutMs: overrides.timeoutMs ?? envNumber("REPLAYAI_TIMEOUT", 30000),
    maxSteps: overrides.maxSteps ?? envNumber("REPLAYAI_MAX_STEPS", 200),
    redactStrict: overrides.redactStrict ?? envBool("REPLAYAI_REDACT_STRICT", true),
  };
  return cached;
}

function safeRegex(s: string): RegExp {
  try {
    return new RegExp(s, "g");
  } catch {
    return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  }
}

/** Update SDK config programmatically. Only supplied keys are changed. */
export function configure(opts: ConfigOptions): ResolvedConfig {
  overrides = { ...overrides, ...opts };
  cached = null; // force re-resolve on next read
  return resolveConfig();
}

/** Get the active config (re-resolves if `configure()` was called). */
export function getConfig(): ResolvedConfig {
  return resolveConfig();
}

/** Reset to env-only config. Useful for tests. */
export function resetConfig(): void {
  overrides = {};
  cached = null;
}

/**
 * Get the module-level strict flag (mirrors `config.strict`).
 * Use `setStrictMode()` to change it.
 *
 * Note: the Python SDK exposes `replayai.strict_mode` as a settable module
 * attribute. TypeScript doesn't support settable module exports without a
 * hack, so we use explicit get/set functions instead. This is safer than
 * the `export let` pattern (which breaks when reassigned from another module).
 */
export function getStrictMode(): boolean {
  return getConfig().strict;
}

/** Set the module-level strict flag (updates config.strict too). */
export function setStrictMode(value: boolean): void {
  configure({ strict: value });
}

/** @internal Kept for backward compatibility — prefer getStrictMode(). */
export const _strictMode = { get value() { return getStrictMode(); } };
