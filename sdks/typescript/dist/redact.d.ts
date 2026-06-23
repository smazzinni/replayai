/** Return `[REDACTED:<sha256[:8]>]` for `secret`, cached per value. */
export declare function redactMarker(secret: string): string;
/** Legacy exported alias. Returns the same marker shape. */
export declare const REDACTED = "[REDACTED]";
/** Shannon entropy (base-2) of a string. Higher = more random. */
export declare function shannonEntropy(s: string): number;
/**
 * Redact secrets from any value, returning a string.
 *
 * Non-string inputs are first stringified (JSON for objects) so nested
 * secrets are scanned too. Each configured regex pattern is applied in
 * order; matches are replaced with `[REDACTED:<sha256[:8]>]`. Then, if
 * `REPLAYAI_REDACT_STRICT != "false"`, entropy-based detection scrubs any
 * remaining long high-entropy tokens that aren't on the whitelist.
 */
export declare function redactText(value: unknown): string;
/** Redact an optional string. `null`/`undefined` pass through unchanged. */
export declare function redactOptional(value: string | null | undefined): string | null;
/** Internal: clear the marker cache (tests only). */
export declare function _clearMarkerCache(): void;
//# sourceMappingURL=redact.d.ts.map