import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** List all active tokens (never returns the raw token — only prefixes). */
export async function GET() {
  const tokens = await db.apiToken.findMany({
    where: { revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      prefix: true,
      name: true,
      scope: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ tokens });
}

/** Create a new token. Returns the raw token ONCE — it is never retrievable again. */
export async function POST(req: NextRequest) {
  let body: { name?: string; scope?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const { raw, hash, prefix } = generateToken();
  const token = await db.apiToken.create({
    data: {
      tokenHash: hash,
      prefix,
      name: body.name?.trim() || "Default",
      scope:
        body.scope === "readonly" || body.scope === "test"
          ? body.scope
          : "live",
    },
    select: {
      id: true,
      prefix: true,
      name: true,
      scope: true,
      createdAt: true,
    },
  });

  // The raw token is returned exactly once.
  return NextResponse.json(
    { token, rawToken: raw },
    { status: 201 },
  );
}
