// ReplayAI TypeScript SDK — per-model cost estimation.
// Rates are per 1,000,000 tokens in USD, matching the API's estimator.
//
// **Auto-update:** If the `REPLAYAI_COST_RATES_URL` environment variable is
// set, the rate table is fetched from that URL on first use (cached for the
// process lifetime). The URL must return JSON in the same format as
// `DEFAULT_RATES` (a record of model name → {in, out}). If the fetch fails,
// the built-in `DEFAULT_RATES` are used as a fallback.
/** Per-1M-token USD rates for common models. */
export const DEFAULT_RATES = {
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
export const FALLBACK_RATE = DEFAULT_RATES["gpt-4o"];
// ---------------------------------------------------------------------------
// Rate-table loading with optional URL override.
// ---------------------------------------------------------------------------
let ratesCache = null;
let ratesFetchStarted = false;
async function loadRatesFromUrl() {
    const url = process.env.REPLAYAI_COST_RATES_URL;
    if (!url)
        return null;
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { Accept: "application/json" },
        });
        clearTimeout(timer);
        if (!res.ok)
            return null;
        const data = (await res.json());
        // Validate shape: must be a record of model → {in, out}.
        const validated = {};
        for (const [model, rates] of Object.entries(data)) {
            if (typeof rates !== "object" || rates === null)
                continue;
            const r = rates;
            if (typeof r.in !== "number" || typeof r.out !== "number")
                continue;
            validated[model] = { in: r.in, out: r.out };
        }
        return Object.keys(validated).length > 0 ? validated : null;
    }
    catch {
        return null;
    }
}
/**
 * Return the active rate table.
 *
 * On first call, if `REPLAYAI_COST_RATES_URL` is set, rates are fetched
 * from that URL and cached for the process lifetime. On failure, the
 * built-in `DEFAULT_RATES` are used.
 */
export async function getRates() {
    if (ratesCache)
        return ratesCache;
    const fetched = await loadRatesFromUrl();
    ratesCache = fetched ?? { ...DEFAULT_RATES };
    return ratesCache;
}
/** Synchronous variant — uses the cache or falls back to DEFAULT_RATES.
 *
 *  On first call, if `REPLAYAI_COST_RATES_URL` is set, kicks off a background
 *  fetch (fire-and-forget) so subsequent calls pick up the fetched rates.
 *  This ensures `estimateCost()` (which is sync) eventually uses the URL
 *  rates without blocking on a network call. */
export function getRatesSync() {
    if (!ratesCache && !ratesFetchStarted) {
        ratesFetchStarted = true;
        // Fire-and-forget: populate the cache for subsequent calls.
        loadRatesFromUrl().then((fetched) => {
            if (fetched)
                ratesCache = fetched;
        }).catch(() => { });
    }
    return ratesCache ?? { ...DEFAULT_RATES };
}
/** Clear the rate-table cache. Useful for tests. */
export function _resetRatesCache() {
    ratesCache = null;
    ratesFetchStarted = false;
}
/**
 * Estimate total USD cost across a list of steps.
 * Steps without a model use the fallback rate; steps without tokens
 * contribute zero.
 *
 * When `rates` is not supplied, the synchronous rate table is used
 * (honors `REPLAYAI_COST_RATES_URL` if the cache has been populated via
 * `getRates()`).
 */
export function estimateCost(steps) {
    const rateTable = getRatesSync();
    const fallback = rateTable["gpt-4o"] ?? FALLBACK_RATE;
    let total = 0;
    for (const s of steps) {
        const model = s.model ?? undefined;
        const rate = model && rateTable[model] ? rateTable[model] : fallback;
        const tokensIn = s.tokensIn ?? 0;
        const tokensOut = s.tokensOut ?? 0;
        total += (tokensIn / 1_000_000) * rate.in;
        total += (tokensOut / 1_000_000) * rate.out;
    }
    return Math.round(total * 1_000_000) / 1_000_000;
}
/** Estimate cost for a single step. */
export function estimateStepCost(model, tokensIn = 0, tokensOut = 0) {
    return estimateCost([{ model, tokensIn, tokensOut }]);
}
/** Read-only copy of the rate table. */
export function getModelRates() {
    return { ...getRatesSync() };
}
//# sourceMappingURL=cost.js.map