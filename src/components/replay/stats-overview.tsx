"use client";

import { cn } from "@/lib/utils";
import { useStats } from "@/hooks/use-api";
import { fmtCost, fmtDuration } from "@/lib/replay-data";
import {
  Activity,
  Coins,
  Layers,
  Percent,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { motion } from "framer-motion";
import { useMemo } from "react";

const STATS = [
  {
    key: "total",
    label: "Sessions",
    icon: Layers,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    key: "failed",
    label: "Failed",
    icon: TriangleAlert,
    color: "text-rose-300",
    bg: "bg-rose-500/10",
  },
  {
    key: "steps",
    label: "Steps",
    icon: Activity,
    color: "text-sky-300",
    bg: "bg-sky-500/10",
  },
  {
    key: "cost",
    label: "Cost",
    icon: Coins,
    color: "text-amber-300",
    bg: "bg-amber-500/10",
  },
  {
    key: "failrate",
    label: "Fail rate",
    icon: Percent,
    color: "text-violet-300",
    bg: "bg-violet-500/10",
  },
  {
    key: "avgDuration",
    label: "Avg run",
    icon: Timer,
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
  },
] as const;

/** Build an SVG sparkline path from the daily trend data. */
function useSparklinePath(
  data: { total: number }[],
  width = 120,
  height = 28,
): { path: string; areaPath: string; max: number } {
  return useMemo(() => {
    if (data.length === 0) return { path: "", areaPath: "", max: 0 };
    const max = Math.max(1, ...data.map((d) => d.total));
    const stepX = data.length > 1 ? width / (data.length - 1) : width;
    const points = data.map((d, i) => {
      const x = i * stepX;
      const y = height - (d.total / max) * (height - 4) - 2;
      return [x, y] as const;
    });
    const path = points
      .map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`))
      .join(" ");
    const areaPath = `${path} L ${width} ${height} L 0 ${height} Z`;
    return { path, areaPath, max };
  }, [data, width, height]);
}

export function StatsOverview() {
  const { data, isLoading } = useStats();

  const values: Record<string, string> = {
    total: data ? String(data.totalSessions) : "—",
    failed: data ? String(data.failedSessions) : "—",
    steps: data ? String(data.totalSteps) : "—",
    cost: data ? fmtCost(data.totalCost) : "—",
    failrate: data ? `${data.failRate.toFixed(0)}%` : "—",
    avgDuration: data ? fmtDuration(data.avgDurationMs) : "—",
  };

  const trend = data?.dailyTrend ?? [];
  const spark = useSparklinePath(trend);
  const costByModel = data?.costByModel ?? [];
  const maxModelCost = Math.max(0.001, ...costByModel.map((m) => m.cost));

  return (
    <div className="space-y-2.5">
      {/* Stat cards row */}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.key}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: i * 0.04 }}
              className="group relative overflow-hidden rounded-lg border border-border/50 bg-card/40 px-3 py-2 transition hover:border-border/80 hover:bg-card/60"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded transition group-hover:scale-110",
                    s.bg,
                  )}
                >
                  <Icon className={cn("h-3 w-3", s.color)} />
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </span>
              </div>
              <div className="mt-1 font-mono text-[16px] font-semibold tabular-nums">
                {isLoading ? (
                  <span className="inline-block h-4 w-10 animate-pulse rounded bg-muted" />
                ) : (
                  values[s.key]
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Sparkline + cost-by-model row */}
      <div className="grid gap-2 sm:grid-cols-2">
        {/* 14-day trend sparkline */}
        <div className="rounded-lg border border-border/50 bg-card/30 px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              14-day activity
            </span>
            <div className="flex items-center gap-2.5">
              <span className="inline-flex items-center gap-1 text-[9.5px] text-muted-foreground/70">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                ok
              </span>
              <span className="inline-flex items-center gap-1 text-[9.5px] text-muted-foreground/70">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                failed
              </span>
              <span className="font-mono text-[10px] text-muted-foreground/70">
                {trend.reduce((a, d) => a + d.total, 0)}
              </span>
            </div>
          </div>
          {isLoading ? (
            <div className="h-7 w-full animate-pulse rounded bg-muted/40" />
          ) : trend.some((d) => d.total > 0) && spark.path ? (
            <svg
              viewBox="0 0 120 28"
              preserveAspectRatio="none"
              className="h-7 w-full"
            >
              <defs>
                <linearGradient id="spark-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="oklch(0.72 0.16 162)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="oklch(0.72 0.16 162)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={spark.areaPath} fill="url(#spark-grad)" />
              <path
                d={spark.path}
                fill="none"
                stroke="oklch(0.72 0.16 162)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {trend.map((d, i) => {
                if (d.total === 0) return null;
                const stepX = trend.length > 1 ? 120 / (trend.length - 1) : 120;
                const x = i * stepX;
                const y = 28 - (d.total / spark.max) * 24 - 2;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r={d.failed > 0 ? 2 : 1.5}
                    fill={d.failed > 0 ? "oklch(0.68 0.2 22)" : "oklch(0.72 0.16 162)"}
                  />
                );
              })}
            </svg>
          ) : (
            <div className="flex h-7 items-center justify-center gap-1.5 text-[10px] text-muted-foreground/50">
              <span>No recent activity —</span>
              <span className="text-primary/70">hit Record to capture a run</span>
            </div>
          )}
        </div>

        {/* Cost by model bar chart */}
        <div className="rounded-lg border border-border/50 bg-card/30 px-3 py-2">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Cost by model
            </span>
            <span className="font-mono text-[10px] text-muted-foreground/70">
              {fmtCost(data?.totalCost ?? 0)} total
            </span>
          </div>
          {isLoading ? (
            <div className="h-7 w-full animate-pulse rounded bg-muted/40" />
          ) : costByModel.length > 0 ? (
            <div className="space-y-1">
              {costByModel.slice(0, 4).map((m) => (
                <div
                  key={m.model}
                  className="group/model relative flex items-center gap-2"
                >
                  <span className="w-16 shrink-0 truncate font-mono text-[9.5px] text-muted-foreground">
                    {m.model}
                  </span>
                  <div className="relative h-2.5 flex-1 overflow-hidden rounded-full bg-muted/40">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(m.cost / maxModelCost) * 100}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-amber-500/60 to-amber-400"
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono text-[9.5px] tabular-nums text-muted-foreground">
                    {fmtCost(m.cost)}
                  </span>
                  {/* Hover tooltip with full breakdown */}
                  <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 group-hover/model:block">
                    <div className="whitespace-nowrap rounded-md border border-border/60 bg-popover px-2.5 py-1.5 text-[10px] shadow-lg">
                      <div className="mb-1 font-mono font-semibold text-foreground">
                        {m.model}
                      </div>
                      <div className="space-y-0.5 text-muted-foreground">
                        <div className="flex justify-between gap-3">
                          <span>Tokens in</span>
                          <span className="font-mono tabular-nums text-foreground/80">
                            {(m.tokensIn ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span>Tokens out</span>
                          <span className="font-mono tabular-nums text-foreground/80">
                            {(m.tokensOut ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between gap-3">
                          <span>Steps</span>
                          <span className="font-mono tabular-nums text-foreground/80">
                            {m.steps}
                          </span>
                        </div>
                        <div className="mt-0.5 flex justify-between gap-3 border-t border-border/40 pt-0.5">
                          <span>Cost</span>
                          <span className="font-mono tabular-nums text-amber-400">
                            {fmtCost(m.cost)}
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* arrow */}
                    <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-border/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-7 items-center text-[10px] text-muted-foreground/50">
              No model data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
