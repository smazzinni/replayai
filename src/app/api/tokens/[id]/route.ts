import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Revoke (soft-delete) a token. */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await db.apiToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  } catch {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
