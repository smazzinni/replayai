import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapProject } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const project = await db.project.findUnique({
    where: { slug },
    include: { _count: { select: { sessions: true } } },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  return NextResponse.json({ project: mapProject(project) });
}
