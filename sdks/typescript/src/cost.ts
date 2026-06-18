// ReplayAI TypeScript SDK — per-model cost estimation.
// Rates are per 1,000,000 tokens in USD, matching the API's estimator.

import type { SessionStep } from "./types.js";

interface Rate {
  in: number;
  out: number;
}

/** Per-1M-token USD rates for common models. */
export const DEFAULT_RATES: Record<string, Rate> = {
  "gpt-4o": { in: 2.5, out: 10.0 },
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4-turbo": { in: 10.0, out: 30.0 },
  "gpt-3.5-turbo": { in: 0.5, out: 1.5 },
  "claude-3.5-sonnet": { in: 3.0, out: 15.0 },
  "claude-3-5-haiku": { in: 0.8, out: 4.0 },
  "claude-3-opus": { in: 15.0, out: 75.0 },
  "gemini-1.5-pro": { in: 1.25, out: 5.0 },
  "gemini-1.5-flash": { in: 0.075, out: 0.3 },
  "llama-3.1-70b": { in: 0.59, out: 0.79 },
};

/** Fallback rate used when a model isn't in the table. Matches the API. */
export const FALLBACK_RATE: Rate = DEFAULT_RATES["gpt-4o"];

/**
 * Estimate total USD cost across a list of steps.
 * Steps without a model use the fallback rate; steps without tokens
 * contribute zero.
 */
export function estimateCost(steps: Array<SessionStep | { model?: string | null; tokensIn?: number | null; tokensOut?: number | null }>): number {
  let total = 0;
  for (const s of steps) {
    const model = s.model ?? undefined;
    const rate = model && DEFAULT_RATES[model] ? DEFAULT_RATES[model] : FALLBACK_RATE;
    const tokensIn = s.tokensIn ?? 0;
    const tokensOut = s.tokensOut ?? 0;
    total += (tokensIn / 1_000_000) * rate.in;
    total += (tokensOut / 1_000_000) * rate.out;
  }
  return Math.round(total * 1_000_000) / 1_000_000;
}

/** Estimate cost for a single step. */
export function estimateStepCost(
  model: string | null | undefined,
  tokensIn = 0,
  tokensOut = 0,
): number {
  return estimateCost([{ model, tokensIn, tokensOut }]);
}

/** Read-only copy of the rate table. */
export function getModelRates(): Record<string, Rate> {
  return { ...DEFAULT_RATES };
}
