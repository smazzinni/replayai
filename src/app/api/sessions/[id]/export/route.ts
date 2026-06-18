import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mapSession } from "@/lib/mappers";
import { generateTest, type ExportLang } from "@/lib/replay-data";

export const dynamic = "force-dynamic";

/**
 * GET /api/sessions/[id]/export?lang=pytest|jest
 * Returns the generated test as plain text (with a download filename header).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const lang = (searchParams.get("lang") ?? "pytest") as ExportLang;
  const download = searchParams.get("download") === "1";

  const session = await db.session.findUnique({
    where: { id },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const code = generateTest(mapSession(session), lang);
  const ext = lang === "pytest" ? "py" : "test.ts";
  const filename = `${id}.${ext}`;

  const headers: Record<string, string> = {
    "Content-Type": lang === "pytest" ? "text/x-python" : "text/typescript",
    "Cache-Control": "no-store",
  };
  if (download) {
    headers["Content-Disposition"] = `attachment; filename="${filename}"`;
  }

  return new NextResponse(code, { headers });
}
