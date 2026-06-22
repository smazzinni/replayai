"use strict";
// ReplayAI TypeScript SDK — per-model cost estimation.
// Rates are per 1,000,000 tokens in USD, matching the API's estimator.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FALLBACK_RATE = exports.DEFAULT_RATES = void 0;
exports.estimateCost = estimateCost;
exports.estimateStepCost = estimateStepCost;
exports.getModelRates = getModelRates;
/** Per-1M-token USD rates for common models. */
exports.DEFAULT_RATES = {
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
exports.FALLBACK_RATE = exports.DEFAULT_RATES["gpt-4o"];
/**
 * Estimate total USD cost across a list of steps.
 * Steps without a model use the fallback rate; steps without tokens
 * contribute zero.
 */
function estimateCost(steps) {
    let total = 0;
    for (const s of steps) {
        const model = s.model ?? undefined;
        const rate = model && exports.DEFAULT_RATES[model] ? exports.DEFAULT_RATES[model] : exports.FALLBACK_RATE;
        const tokensIn = s.tokensIn ?? 0;
        const tokensOut = s.tokensOut ?? 0;
        total += (tokensIn / 1_000_000) * rate.in;
        total += (tokensOut / 1_000_000) * rate.out;
    }
    return Math.round(total * 1_000_000) / 1_000_000;
}
/** Estimate cost for a single step. */
function estimateStepCost(model, tokensIn = 0, tokensOut = 0) {
    return estimateCost([{ model, tokensIn, tokensOut }]);
}
/** Read-only copy of the rate table. */
function getModelRates() {
    return { ...exports.DEFAULT_RATES };
}
//# sourceMappingURL=cost.js.map