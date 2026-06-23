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
 * Estimate total USD cost across a list of steps.
 * Steps without a model use the fallback rate; steps without tokens
 * contribute zero.
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