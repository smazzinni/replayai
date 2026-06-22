import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { estimateCost } from "@/lib/session-ingest";

export const dynamic = "force-dynamic";

/** GET /api/stats — aggregate dashboard metrics.
 *
 * Returns totals, a 14-day daily trend (for sparklines), cost-by-model
 * breakdown, and recent session ids. */
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
    avgDuration,
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
    db.session.aggregate({ _avg: { durationMs: true } }),
  ]);

  // 14-day daily trend for the sparkline. Each entry: { date, total, failed }.
  const since = new Date(Date.now() - 13 * 24 * 60 * 60 * 1000);
  since.setHours(0, 0, 0, 0);
  const recentSessions = await db.session.findMany({
    where: { startedAt: { gte: since } },
    select: { startedAt: true, status: true },
  });

  // Build the 14-day bucket map.
  const dailyMap = new Map<string, { total: number; failed: number }>();
  for (let i = 0; i < 14; i++) {
    const d = new Date(since);
    d.setDate(d.getDate() + i);
    dailyMap.set(d.toISOString().slice(0, 10), { total: 0, failed: 0 });
  }
  for (const s of recentSessions) {
    const key = s.startedAt.toISOString().slice(0, 10);
    const bucket = dailyMap.get(key);
    if (bucket) {
      bucket.total++;
      if (s.status === "failed") bucket.failed++;
    }
  }
  const dailyTrend = Array.from(dailyMap.entries()).map(([date, v]) => ({
    date,
    ...v,
  }));

  // Cost-by-model breakdown (top 6 models by cost). Tracks tokensIn and
  // tokensOut separately so the per-model cost is EXACT (not a heuristic).
  const stepsWithModel = await db.step.findMany({
    where: { model: { not: null } },
    select: { model: true, tokensIn: true, tokensOut: true },
  });
  const modelMap = new Map<
    string,
    { tokensIn: number; tokensOut: number; count: number }
  >();
  for (const st of stepsWithModel) {
    if (!st.model) continue;
    const entry = modelMap.get(st.model) ?? { tokensIn: 0, tokensOut: 0, count: 0 };
    entry.tokensIn += st.tokensIn ?? 0;
    entry.tokensOut += st.tokensOut ?? 0;
    entry.count++;
    modelMap.set(st.model, entry);
  }
  const costByModel = Array.from(modelMap.entries())
    .map(([model, v]) => {
      // Exact cost using the real in/out split + the shared rate table.
      const cost = estimateCost([
        { model, tokensIn: v.tokensIn, tokensOut: v.tokensOut },
      ]);
      return {
        model,
        cost,
        tokens: v.tokensIn + v.tokensOut,
        tokensIn: v.tokensIn,
        tokensOut: v.tokensOut,
        steps: v.count,
      };
    })
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 6);

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
    avgDurationMs: Math.round(avgDuration._avg.durationMs ?? 0),
    avgSteps: totalSessions > 0 ? Math.round((totalSteps / totalSessions) * 10) / 10 : 0,
    dailyTrend,
    costByModel,
    recentIds: recent.map((s) => s.id),
  });
}
