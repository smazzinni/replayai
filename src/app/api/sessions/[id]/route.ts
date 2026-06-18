import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapSessionWithProject } from "@/lib/mappers";
import { broadcast } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await db.session.findUnique({
    where: { id },
    include: {
      project: true,
      steps: { orderBy: { order: "asc" } },
    },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json({ session: mapSessionWithProject(session) });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let body: {
    name?: string;
    status?: string;
    tags?: string[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const existing = await db.session.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if (
    body.status === "success" ||
    body.status === "failed" ||
    body.status === "running"
  ) {
    data.status = body.status;
  }
  if (Array.isArray(body.tags)) {
    data.tags = body.tags.filter((t) => typeof t === "string").join(",");
  }

  const updated = await db.session.update({
    where: { id },
    data,
    include: {
      project: true,
      steps: { orderBy: { order: "asc" } },
    },
  });

  const mapped = mapSessionWithProject(updated);
  void broadcast("session:updated", { session: mapped });

  return NextResponse.json({ session: mapped });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await db.session.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  void broadcast("session:deleted", { id });
  return NextResponse.json({ ok: true });
}
