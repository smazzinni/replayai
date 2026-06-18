export declare const REDACTED = "[REDACTED]";
/**
 * Redact secrets from any value, returning a string.
 *
 * Non-string inputs are first stringified (JSON for objects) so nested
 * secrets are scanned too. Each configured regex pattern is applied in
 * order; matches are replaced with `[REDACTED]`.
 */
export declare function redactText(value: unknown): string;
/** Redact an optional string. `null`/`undefined` pass through unchanged. */
export declare function redactOptional(value: string | null | undefined): string | null;
//# sourceMappingURL=redact.d.ts.map