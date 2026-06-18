"use client";

import { cn } from "@/lib/utils";
import {
  fmtCost,
  fmtDuration,
  type AgentSession,
  type SessionStatus,
} from "@/lib/replay-data";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

const STATUS_ICON: Record<
  SessionStatus,
  { icon: typeof CheckCircle2; className: string }
> = {
  success: { icon: CheckCircle2, className: "text-emerald-400" },
  failed: { icon: XCircle, className: "text-rose-400" },
  running: { icon: Loader2, className: "text-sky-400 animate-spin" },
};

interface SessionsListProps {
  sessions: AgentSession[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function SessionsList({
  sessions,
  selectedId,
  onSelect,
}: SessionsListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "failed" | "success">("all");

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (filter === "failed" && s.status !== "failed") return false;
      if (filter === "success" && s.status !== "success") return false;
      if (
        query &&
        !`${s.name} ${s.agent} ${s.tags.join(" ")}`
          .toLowerCase()
          .includes(query.toLowerCase())
      )
        return false;
      return true;
    });
  }, [sessions, query, filter]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions…"
            className="h-8 w-full rounded-md border border-border/60 bg-background/60 pl-8 pr-3 text-[12.5px] outline-none transition focus:border-primary/60 focus:bg-background"
          />
        </div>
        <div className="mt-2.5 flex gap-1">
          {(["all", "failed", "success"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-[11px] font-medium capitalize transition",
                filter === f
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              {f === "all"
                ? `All (${sessions.length})`
                : f === "failed"
                  ? `Failed (${sessions.filter((s) => s.status === "failed").length})`
                  : `OK (${sessions.filter((s) => s.status === "success").length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
        {filtered.length === 0 ? (
          <div className="px-3 py-10 text-center text-[12px] text-muted-foreground">
            No sessions match.
          </div>
        ) : (
          filtered.map((s) => {
            const active = s.id === selectedId;
            const meta = STATUS_ICON[s.status];
            const Icon = meta.icon;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "group mb-1.5 w-full rounded-lg border px-3 py-2.5 text-left transition",
                  active
                    ? "border-primary/50 bg-primary/10"
                    : "border-transparent hover:border-border/70 hover:bg-muted/50",
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon
                    className={cn("mt-0.5 h-4 w-4 shrink-0", meta.className)}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "truncate text-[12.5px] font-medium",
                        active ? "text-foreground" : "text-foreground/90",
                      )}
                    >
                      {s.name}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                      <span className="font-mono">{s.agent}</span>
                      <span className="opacity-40">·</span>
                      <span>{s.framework}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {fmtDuration(s.durationMs)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Coins className="h-3 w-3" />
                        {fmtCost(s.costUsd)}
                      </span>
                      <span>{s.steps.length} steps</span>
                      {s.tags.slice(0, 1).map((t) => (
                        <span
                          key={t}
                          className="rounded bg-muted px-1.5 py-px text-[9.5px] uppercase tracking-wide text-muted-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                {active && (
                  <motion.div
                    layoutId="session-active-bar"
                    className="mt-2 h-0.5 w-full rounded-full bg-primary/70"
                  />
                )}
              </button>
            );
          })
        )}
      </div>

      <div className="border-t border-border/60 px-3 py-2 text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-amber-400" />
          Recording via{" "}
          <code className="rounded bg-muted px-1 py-px font-mono text-[10px] text-foreground/80">
            replayai.start()
          </code>
        </span>
      </div>
    </div>
  );
}
