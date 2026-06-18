import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAuth, getAuthHeader } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/onboarding — returns setup status: whether any tokens/projects
 * exist, plus the install commands. Powers the 1-click install / onboarding view.
 */
export async function GET() {
  const [tokenCount, projectCount, sessionCount] = await Promise.all([
    db.apiToken.count({ where: { revokedAt: null } }),
    db.project.count(),
    db.session.count(),
  ]);

  return NextResponse.json({
    hasToken: tokenCount > 0,
    hasProject: projectCount > 0,
    hasSession: sessionCount > 0,
    tokenCount,
    projectCount,
    sessionCount,
    devMode: process.env.REPLAYAI_DEV === "1",
    install: {
      python: "pip install replayai",
      typescript: "npm install @replayai/sdk",
      cli: "curl -fsSL https://replayai.dev/install | sh",
    },
  });
}

/**
 * POST /api/onboarding — "test connection": the onboarding wizard asks the
 * user to run a one-liner with their token. This endpoint validates that a
 * token works end-to-end by checking it against the DB.
 */
export async function POST(req: NextRequest) {
  const auth = await validateAuth(getAuthHeader(req));
  if (!auth.ok) {
    return NextResponse.json(
      { connected: false, error: auth.error },
      { status: 401 },
    );
  }
  return NextResponse.json({
    connected: true,
    devBypass: auth.devBypass ?? false,
    message: auth.devBypass
      ? "Connection OK (dev mode — auth bypassed)."
      : "Connection OK — token validated.",
  });
}
