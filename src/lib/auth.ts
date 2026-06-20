// Server-only auth: validates API tokens with a dev bypass.
import { db } from "@/lib/db";
import crypto from "node:crypto";

function isDevMode(): boolean {
  return process.env.REPLAYAI_DEV === "1";
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  tokenId?: string;
  devBypass?: boolean;
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function generateToken(): { raw: string; hash: string; prefix: string } {
  const bytes = crypto.randomBytes(24);
  const raw = `rai_live_${bytes.toString("hex")}`;
  const hash = hashToken(raw);
  const prefix = `${raw.slice(0, 14)}…`;
  return { raw, hash, prefix };
}

export async function validateAuth(authHeader: string | null): Promise<AuthResult> {
  if (isDevMode()) return { ok: true, devBypass: true };

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const raw = authHeader.slice("Bearer ".length).trim();
    if (raw) {
      const hash = hashToken(raw);
      const token = await db.apiToken.findUnique({ where: { tokenHash: hash } });
      if (token && !token.revokedAt) {
        void db.apiToken.update({ where: { id: token.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
        return { ok: true, tokenId: token.id };
      }
      return { ok: false, error: "Invalid or revoked token" };
    }
  }

  const tokenCount = await db.apiToken.count({ where: { revokedAt: null } });
  if (tokenCount === 0) return { ok: true, devBypass: true };

  return { ok: false, error: "Missing Authorization header" };
}

export function getAuthHeader(req: Request): string | null {
  return req.headers.get("authorization");
}

export function unauthorized(error?: string) {
  return Response.json({ error: error ?? "Unauthorized" }, { status: 401 });
}
