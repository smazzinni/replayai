import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthHeader, unauthorized, validateAuth } from "@/lib/auth";
import { getClientIP, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** DELETE /api/comments/[id] — delete a comment */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await validateAuth(getAuthHeader(req));
  if (!auth.ok) return unauthorized(auth.error);

  const rl = rateLimit(getClientIP(req));
  if (!rl.ok) return tooManyRequests();

  const { id } = await params;
  try {
    await db.comment.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
