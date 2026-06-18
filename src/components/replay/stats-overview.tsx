"use client";

import { cn } from "@/lib/utils";
import { useStats } from "@/hooks/use-api";
import { fmtCost } from "@/lib/replay-data";
import {
  Activity,
  Coins,
  Layers,
  Percent,
  TriangleAlert,
} from "lucide-react";
import { motion } from "framer-motion";

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
] as const;

export function StatsOverview() {
  const { data, isLoading } = useStats();

  const values: Record<string, string> = {
    total: data ? String(data.totalSessions) : "—",
    failed: data ? String(data.failedSessions) : "—",
    steps: data ? String(data.totalSteps) : "—",
    cost: data ? fmtCost(data.totalCost) : "—",
    failrate: data ? `${data.failRate.toFixed(0)}%` : "—",
  };

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {STATS.map((s, i) => {
        const Icon = s.icon;
        return (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: i * 0.04 }}
            className="rounded-lg border border-border/50 bg-card/40 px-3 py-2"
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded",
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
  );
}
