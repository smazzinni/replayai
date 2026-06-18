// Server-only auth: validates API tokens with a dev bypass.
//
// In production: requests must carry `Authorization: Bearer rai_live_...`.
// In dev (REPLAYAI_DEV=1, or no tokens exist in the DB yet): auth is bypassed
// so the dashboard and SDK demos work out of the box. Flip REPLAYAI_DEV off
// once you've created a token to enforce auth.

import { db } from "@/lib/db";
import crypto from "node:crypto";

const DEV_MODE = process.env.REPLAYAI_DEV === "1";

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
  if (DEV_MODE) {
    return { ok: true, devBypass: true };
  }

  // Dev bypass #2: no tokens have been issued yet — open access for first-run.
  const tokenCount = await db.apiToken.count({
    where: { revokedAt: null },
  });
  if (tokenCount === 0) {
    return { ok: true, devBypass: true };
  }

  // Production path: require a valid bearer token.
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, error: "Missing or malformed Authorization header" };
  }
  const raw = authHeader.slice("Bearer ".length).trim();
  if (!raw) {
    return { ok: false, error: "Empty bearer token" };
  }
  const hash = hashToken(raw);
  const token = await db.apiToken.findUnique({
    where: { tokenHash: hash },
  });
  if (!token || token.revokedAt) {
    return { ok: false, error: "Invalid or revoked token" };
  }

  // Update last-used (fire-and-forget, never blocks).
  void db.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return { ok: true, tokenId: token.id };
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
