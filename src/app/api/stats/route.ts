import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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

  // Cost-by-model breakdown (top 6 models by cost).
  const stepsWithModel = await db.step.findMany({
    where: { model: { not: null } },
    select: { model: true, tokensIn: true, tokensOut: true },
  });
  const modelMap = new Map<string, { tokens: number; count: number }>();
  for (const st of stepsWithModel) {
    if (!st.model) continue;
    const entry = modelMap.get(st.model) ?? { tokens: 0, count: 0 };
    entry.tokens += (st.tokensIn ?? 0) + (st.tokensOut ?? 0);
    entry.count++;
    modelMap.set(st.model, entry);
  }
  // Estimate cost per model using the same rates as the ingest path.
  const RATES: Record<string, { in: number; out: number }> = {
    "gpt-4o": { in: 2.5, out: 10 },
    "gpt-4o-mini": { in: 0.15, out: 0.6 },
    "gpt-4-turbo": { in: 10, out: 30 },
    "gpt-3.5-turbo": { in: 0.5, out: 1.5 },
    "claude-3.5-sonnet": { in: 3, out: 15 },
    "claude-3-5-haiku": { in: 0.8, out: 4 },
    "claude-3-opus": { in: 15, out: 75 },
    "gemini-1.5-pro": { in: 1.25, out: 5 },
    "gemini-1.5-flash": { in: 0.075, out: 0.3 },
    "llama-3.1-70b": { in: 0.59, out: 0.79 },
  };
  const fallback = RATES["gpt-4o"];
  const costByModel = Array.from(modelMap.entries())
    .map(([model, v]) => {
      const rate = RATES[model] ?? fallback;
      // We don't have the in/out split per step here, so estimate with a
      // 3:1 out:in ratio heuristic (typical for completions). This is only
      // for the dashboard chart — the per-session cost is exact.
      const estCost = (v.tokens / 1_000_000) * ((rate.in + rate.out * 3) / 4);
      return { model, cost: Math.round(estCost * 1000) / 1000, tokens: v.tokens, steps: v.count };
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
