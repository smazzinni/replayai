// Server-only auth: validates API tokens with a dev bypass.
//
// In production: requests must carry `Authorization: Bearer rai_live_...`.
// In dev (REPLAYAI_DEV=1, or no tokens exist in the DB yet): auth is bypassed
// so the dashboard and SDK demos work out of the box. Flip REPLAYAI_DEV off
// once you've created a token to enforce auth.

import { db } from "@/lib/db";
import crypto from "node:crypto";

/** Check dev mode at call time (not module load) so env changes take effect. */
function isDevMode(): boolean {
  return process.env.REPLAYAI_DEV === "1";
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  tokenId?: string;
  devBypass?: boolean;
}

/** Hash a raw token for storage. Only the hash is persisted. */
export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Generate a new raw token + its hash + a display prefix. */
export function generateToken(): {
  raw: string;
  hash: string;
  prefix: string;
} {
  const bytes = crypto.randomBytes(24);
  const raw = `rai_live_${bytes.toString("hex")}`;
  const hash = hashToken(raw);
  const prefix = `${raw.slice(0, 14)}…`;
  return { raw, hash, prefix };
}

/**
 * Validate the Authorization header from a request.
 * Dev-bypasses when REPLAYAI_DEV=1 OR when no tokens exist in the DB.
 */
export async function validateAuth(
  authHeader: string | null,
): Promise<AuthResult> {
  // Dev bypass #1: explicit env flag.
  if (isDevMode()) {
    return { ok: true, devBypass: true };
  }

  // If a bearer token is provided, validate it against the DB.
  // This avoids a DB query for unauthenticated requests.
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const raw = authHeader.slice("Bearer ".length).trim();
    if (raw) {
      const hash = hashToken(raw);
      const token = await db.apiToken.findUnique({
        where: { tokenHash: hash },
      });
      if (token && !token.revokedAt) {
        // Update last-used (fire-and-forget, never blocks).
        void db.apiToken
          .update({
            where: { id: token.id },
            data: { lastUsedAt: new Date() },
          })
          .catch(() => {});
        return { ok: true, tokenId: token.id };
      }
      return { ok: false, error: "Invalid or revoked token" };
    }
  }

  // No token provided — check if any tokens exist.
  // If none exist, allow access (first-run / setup mode).
  const tokenCount = await db.apiToken.count({
    where: { revokedAt: null },
  });
  if (tokenCount === 0) {
    return { ok: true, devBypass: true };
  }

  // Tokens exist but none was provided.
  return { ok: false, error: "Missing Authorization header" };
}

/** Extract the Authorization header from a NextRequest. */
export function getAuthHeader(req: Request): string | null {
  return req.headers.get("authorization");
}

/** Return 401 JSON if auth fails. */
export function unauthorized(error?: string) {
  return Response.json(
    { error: error ?? "Unauthorized" },
    { status: 401 },
  );
}
