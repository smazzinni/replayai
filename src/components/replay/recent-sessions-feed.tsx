"use client";

import { cn } from "@/lib/utils";
import { useSessions } from "@/hooks/use-api";
import { fmtCost, fmtDuration, type SessionStatus } from "@/lib/replay-data";
import { RelativeTime } from "./relative-time";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Loader2,
  XCircle,
} from "lucide-react";

const STATUS_ICON: Record<
  SessionStatus,
  { icon: typeof CheckCircle2; className: string }
> = {
  success: { icon: CheckCircle2, className: "text-emerald-400" },
  failed: { icon: XCircle, className: "text-rose-400" },
  running: { icon: Loader2, className: "text-sky-400 animate-spin" },
};

interface RecentSessionsFeedProps {
  /** Click a session to jump to it in the dashboard. */
  onSelect?: (id: string) => void;
}

/** Compact horizontal feed of the 4 most-recent sessions, shown below the stats strip. */
export function RecentSessionsFeed({ onSelect }: RecentSessionsFeedProps) {
  const { data, isLoading } = useSessions({ limit: 4 });

  const sessions = data?.sessions ?? [];

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[72px] flex-1 animate-pulse rounded-lg border border-border/40 bg-muted/30"
          />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
      {sessions.map((s, i) => {
        const meta = STATUS_ICON[s.status];
        const Icon = meta.icon;
        const stepN = s.stepCount ?? s.steps.length;
        return (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            onClick={() => onSelect?.(s.id)}
            className="group flex min-w-[200px] flex-1 items-center gap-2.5 rounded-lg border border-border/50 bg-card/40 px-3 py-2 text-left transition hover:border-primary/40 hover:bg-card/70"
          >
            <Icon className={cn("h-4 w-4 shrink-0", meta.className)} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11.5px] font-medium text-foreground/90">
                {s.name}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                <span className="font-mono">{s.agent}</span>
                <span className="opacity-40">·</span>
                <RelativeTime iso={s.startedAt} />
              </div>
              <div className="mt-1 flex items-center gap-2.5 text-[9.5px] text-muted-foreground">
                <span className="inline-flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {fmtDuration(s.durationMs)}
                </span>
                <span className="inline-flex items-center gap-0.5">
                  <Coins className="h-2.5 w-2.5" />
                  {fmtCost(s.costUsd)}
                </span>
                <span>{stepN} steps</span>
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition group-hover:translate-x-0.5 group-hover:text-primary" />
          </motion.button>
        );
      })}
    </div>
  );
}
