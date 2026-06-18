import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [
    totalSessions,
    failedSessions,
    successSessions,
    totalSteps,
    totalTokens,
    totalCost,
    projects,
    recent,
  ] = await Promise.all([
    db.session.count(),
    db.session.count({ where: { status: "failed" } }),
    db.session.count({ where: { status: "success" } }),
    db.step.count(),
    db.session.aggregate({ _sum: { tokenTotal: true } }),
    db.session.aggregate({ _sum: { costUsd: true } }),
    db.project.count(),
    db.session.findMany({
      take: 5,
      orderBy: { startedAt: "desc" },
      include: { steps: { take: 0 } },
    }),
  ]);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const last30 = await db.session.groupBy({
    by: ["status"],
    where: { startedAt: { gte: since } },
    _count: true,
  });

  return NextResponse.json({
    totalSessions,
    failedSessions,
    successSessions,
    runningSessions: totalSessions - failedSessions - successSessions,
    totalSteps,
    totalTokens: totalTokens._sum.tokenTotal ?? 0,
    totalCost: totalCost._sum.costUsd ?? 0,
    projects,
    failRate: totalSessions > 0 ? (failedSessions / totalSessions) * 100 : 0,
    last30: last30.map((g) => ({ status: g.status, count: g._count })),
    recentIds: recent.map((s) => s.id),
  });
}
