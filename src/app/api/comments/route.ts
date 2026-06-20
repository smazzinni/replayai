import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthHeader, unauthorized, validateAuth } from "@/lib/auth";
import { getClientIP, rateLimit, tooManyRequests } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/comments?stepId=... or ?sessionId=... */
export async function GET(req: NextRequest) {
  const auth = await validateAuth(getAuthHeader(req));
  if (!auth.ok) return unauthorized(auth.error);

  const rl = rateLimit(getClientIP(req));
  if (!rl.ok) return tooManyRequests();

  const { searchParams } = new URL(req.url);
  const stepId = searchParams.get("stepId");
  const sessionId = searchParams.get("sessionId");

  const where: Record<string, unknown> = {};
  if (stepId) where.stepId = stepId;
  if (sessionId) where.sessionId = sessionId;

  const comments = await db.comment.findMany({
    where,
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      stepId: true,
      sessionId: true,
      author: true,
      body: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ comments });
}

/** POST /api/comments — add a comment to a step */
export async function POST(req: NextRequest) {
  const auth = await validateAuth(getAuthHeader(req));
  if (!auth.ok) return unauthorized(auth.error);

  const rl = rateLimit(getClientIP(req));
  if (!rl.ok) return tooManyRequests();

  let body: { stepId?: string; sessionId?: string; author?: string; body?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.stepId || !body.body?.trim()) {
    return NextResponse.json(
      { error: "stepId and body are required" },
      { status: 400 },
    );
  }

  const commentBody = body.body.trim().slice(0, 5000);
  if (!commentBody) {
    return NextResponse.json({ error: "body cannot be empty" }, { status: 400 });
  }

  const comment = await db.comment.create({
    data: {
      stepId: body.stepId,
      sessionId: body.sessionId || "",
      author: (body.author || "anonymous").trim().slice(0, 100),
      body: commentBody,
    },
    select: {
      id: true,
      stepId: true,
      sessionId: true,
      author: true,
      body: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ comment }, { status: 201 });
}
