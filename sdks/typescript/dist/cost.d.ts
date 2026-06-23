import type { SessionStep } from "./types.js";
interface Rate {
    in: number;
    out: number;
}
/** Per-1M-token USD rates for common models. */
export declare const DEFAULT_RATES: Record<string, Rate>;
/** Fallback rate used when a model isn't in the table. Matches the API. */
export declare const FALLBACK_RATE: Rate;
/**
 * Return the active rate table.
 *
 * On first call, if `REPLAYAI_COST_RATES_URL` is set, rates are fetched
 * from that URL and cached for the process lifetime. On failure, the
 * built-in `DEFAULT_RATES` are used.
 */
export declare function getRates(): Promise<Record<string, Rate>>;
/** Synchronous variant — uses the cache or falls back to DEFAULT_RATES. */
export declare function getRatesSync(): Record<string, Rate>;
/** Clear the rate-table cache. Useful for tests. */
export declare function _resetRatesCache(): void;
/**
 * Estimate total USD cost across a list of steps.
 * Steps without a model use the fallback rate; steps without tokens
 * contribute zero.
 *
 * When `rates` is not supplied, the synchronous rate table is used
 * (honors `REPLAYAI_COST_RATES_URL` if the cache has been populated via
 * `getRates()`).
 */
export declare function estimateCost(steps: Array<SessionStep | {
    model?: string | null;
    tokensIn?: number | null;
    tokensOut?: number | null;
}>): number;
/** Estimate cost for a single step. */
export declare function estimateStepCost(model: string | null | undefined, tokensIn?: number, tokensOut?: number): number;
/** Read-only copy of the rate table. */
export declare function getModelRates(): Record<string, Rate>;
export {};
//# sourceMappingURL=cost.d.ts.map