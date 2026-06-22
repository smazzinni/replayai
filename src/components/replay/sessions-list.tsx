"use client";

import { cn } from "@/lib/utils";
import {
  fmtCost,
  fmtDuration,
  type AgentSession,
  type SessionStatus,
} from "@/lib/replay-data";
import { useDeleteSession } from "@/hooks/use-api";
import { RelativeTime } from "./relative-time";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowDownWideNarrow,
  CheckCircle2,
  Clock,
  Coins,
  Loader2,
  Search,
  Star,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import { useStarredSessions } from "@/hooks/use-starred-sessions";

const STATUS_ICON: Record<
  SessionStatus,
  { icon: typeof CheckCircle2; className: string }
> = {
  success: { icon: CheckCircle2, className: "text-emerald-400" },
  failed: { icon: XCircle, className: "text-rose-400" },
  running: { icon: Loader2, className: "text-sky-400 animate-spin" },
};

type SortKey = "recent" | "duration" | "cost" | "steps";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "duration", label: "Longest first" },
  { value: "cost", label: "Highest cost" },
  { value: "steps", label: "Most steps" },
];

interface SessionsListProps {
  sessions: AgentSession[];
  isLoading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  q: string;
  setQ: (v: string) => void;
  statusFilter: "all" | "failed" | "success";
  setStatusFilter: (v: "all" | "failed" | "success") => void;
}

export function SessionsList({
  sessions,
  isLoading,
  selectedId,
  onSelect,
  q,
  setQ,
  statusFilter,
  setStatusFilter,
}: SessionsListProps) {
  const deleteSession = useDeleteSession();
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [starredOnly, setStarredOnly] = useState(false);
  const { isStarred, toggleStar } = useStarredSessions();

  const starredCount = useMemo(
    () => sessions.filter((s) => isStarred(s.id)).length,
    [sessions, isStarred],
  );

  const counts = useMemo(
    () => ({
      all: sessions.length,
      failed: sessions.filter((s) => s.status === "failed").length,
      success: sessions.filter((s) => s.status === "success").length,
    }),
    [sessions],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const out = sessions.filter((s) => {
      if (starredOnly && !isStarred(s.id)) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (
        needle &&
        !`${s.name} ${s.agent} ${s.tags.join(" ")}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
    // Sort the filtered list client-side (the API already sorts by startedAt
    // desc, but the user can re-sort here for quick exploration).
    out.sort((a, b) => {
      switch (sortBy) {
        case "duration":
          return b.durationMs - a.durationMs;
        case "cost":
          return b.costUsd - a.costUsd;
        case "steps":
          return (b.stepCount ?? b.steps.length) - (a.stepCount ?? a.steps.length);
        default:
          return (
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
          );
      }
    });
    return out;
  }, [sessions, q, statusFilter, sortBy, starredOnly, isStarred]);

  const handleDelete = (e: React.MouseEvent, s: AgentSession) => {
    e.stopPropagation();
    const displayName = s.name.length > 60 ? s.name.slice(0, 60) + "…" : s.name;
    if (!confirm(`Delete session "${displayName}"? This cannot be undone.`))
      return;
    deleteSession.mutate(s.id, {
      onSuccess: () => toast.success("Session deleted"),
      onError: (err) =>
        toast.error("Delete failed", {
          description: err instanceof Error ? err.message : "Unknown error",
        }),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sessions…"
            className="h-8 w-full rounded-md border border-border/60 bg-background/60 pl-8 pr-3 text-[12.5px] outline-none transition focus:border-primary/60 focus:bg-background"
          />
        </div>
        <div className="mt-2.5 flex gap-1">
          {(["all", "failed", "success"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "flex-1 rounded-md px-2 py-1 text-[11px] font-medium capitalize transition",
                statusFilter === f
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
            >
              {f === "all"
                ? `All (${counts.all})`
                : f === "failed"
                  ? `Failed (${counts.failed})`
                  : `OK (${counts.success})`}
            </button>
          ))}
          <button
            onClick={() => setStarredOnly((v) => !v)}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition",
              starredOnly
                ? "bg-amber-500/15 text-amber-400"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
            )}
            title="Show only starred sessions"
          >
            <Star className={cn("h-3 w-3", starredOnly && "fill-current")} />
            {starredCount > 0 && starredCount}
          </button>
        </div>
        {/* Sort dropdown */}
        <div className="relative mt-2">
          <ArrowDownWideNarrow className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            className="h-7 w-full appearance-none rounded-md border border-border/60 bg-background/60 pl-7 pr-2 text-[11px] text-muted-foreground outline-none transition focus:border-primary/60 hover:text-foreground"
            title="Sort sessions"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[68px] animate-pulse rounded-lg border border-border/40 bg-muted/30"
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-12 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted/50">
              <Search className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-[12.5px] font-medium text-foreground/80">
              No sessions found
            </div>
            <div className="mt-1 text-[11.5px] text-muted-foreground">
              {q || statusFilter !== "all"
                ? "Try adjusting your filters."
                : "Hit Record to capture your first run."}
            </div>
          </div>
        ) : (
          filtered.map((s, idx) => {
            const active = s.id === selectedId;
            const meta = STATUS_ICON[s.status];
            const Icon = meta.icon;
            const stepN = s.stepCount ?? s.steps.length;
            return (
              <div
                key={s.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelect(s.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(s.id);
                  }
                }}
                className={cn(
                  "group relative mb-1.5 w-full cursor-pointer rounded-lg border px-3 py-2.5 text-left transition",
                  active
                    ? "border-primary/50 bg-primary/10 shadow-[0_0_0_1px_oklch(0.72_0.16_162/0.2)]"
                    : "border-transparent hover:border-border/70 hover:bg-muted/50",
                )}
              >
                <div className="flex items-start gap-2">
                  <Icon
                    className={cn("mt-0.5 h-4 w-4 shrink-0", meta.className)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[9px] text-muted-foreground/50">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <div
                        className={cn(
                          "truncate text-[12.5px] font-medium",
                          active ? "text-foreground" : "text-foreground/90",
                        )}
                      >
                        {s.name}
                      </div>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-[10.5px] text-muted-foreground">
                      <span className="font-mono">{s.agent}</span>
                      <span className="opacity-40">·</span>
                      <RelativeTime iso={s.startedAt} />
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
                      <span>{stepN} steps</span>
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
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStar(s.id);
                    }}
                    className={cn(
                      "transition hover:text-amber-400",
                      isStarred(s.id)
                        ? "text-amber-400"
                        : "text-muted-foreground/40 opacity-0 group-hover:opacity-100",
                    )}
                    title={isStarred(s.id) ? "Unstar session" : "Star session"}
                    aria-label="Toggle star"
                  >
                    <Star
                      className={cn("h-3.5 w-3.5", isStarred(s.id) && "fill-current")}
                    />
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, s)}
                    disabled={deleteSession.isPending}
                    className="opacity-0 transition group-hover:opacity-100 hover:text-rose-400"
                    title="Delete session"
                    aria-label="Delete session"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {active && (
                  <motion.div
                    layoutId="session-active-bar"
                    className="mt-2 h-0.5 w-full rounded-full bg-primary/70"
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border/60 px-3 py-2 text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-amber-400" />
          Recording via{" "}
          <code className="rounded bg-muted px-1 py-px font-mono text-[10px] text-foreground/80">
            replayai.trace()
          </code>
        </span>
      </div>
    </div>
  );
}
