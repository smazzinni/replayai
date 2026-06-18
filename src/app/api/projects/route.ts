import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapProject } from "@/lib/mappers";

export const dynamic = "force-dynamic";

export async function GET() {
  const projects = await db.project.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { sessions: true } } },
  });
  return NextResponse.json({ projects: projects.map(mapProject) });
}

export async function POST(req: NextRequest) {
  let body: {
    name?: string;
    framework?: string;
    description?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || `proj-${Date.now()}`;

  const existing = await db.project.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json(
      { error: "A project with that name already exists" },
      { status: 409 },
    );
  }

  const project = await db.project.create({
    data: {
      name,
      slug,
      framework: body.framework?.trim() || "Custom",
      description: body.description?.trim() || null,
    },
  });

  return NextResponse.json({ project: mapProject(project) }, { status: 201 });
}
