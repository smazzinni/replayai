"use client";

import { cn } from "@/lib/utils";
import {
  diffSessions,
  fmtDuration,
  STEP_META,
  STATUS_META,
  type AgentSession,
} from "@/lib/replay-data";
import { useSession } from "@/hooks/use-api";
import { AlertTriangle, ArrowRight, ChevronDown, ChevronRight, GitCompareArrows, Loader2, Minus, Plus, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

interface DiffViewProps {
  sessions: AgentSession[];
  presetPair?: { left: string; right: string; nonce: number } | null;
}

const COLLAPSE_THRESHOLD = 180; // chars — outputs longer than this get a "show more" toggle

export function DiffView({ sessions, presetPair }: DiffViewProps) {
  const [leftId, setLeftId] = useState("");
  const [rightId, setRightId] = useState("");
  const [userTouched, setUserTouched] = useState(false);

  // Auto-select defaults when sessions load asynchronously.
  // Pick a failed session for A and a successful one for B (if available).
  // Only runs on initial load (when IDs are empty) — never overrides a user choice.
  if (!userTouched && sessions.length > 0) {
    const leftValid = sessions.some((s) => s.id === leftId);
    const rightValid = sessions.some((s) => s.id === rightId);
    if (!leftValid || !rightValid) {
      const failed = sessions.find((s) => s.status === "failed");
      const newLeft = failed?.id ?? sessions[0].id;
      const success = sessions.find((s) => s.id !== newLeft && s.status !== failed?.status);
      const different = sessions.find((s) => s.id !== newLeft);
      setLeftId(newLeft);
      setRightId(success?.id ?? different?.id ?? sessions[0].id);
    }
  }

  // Apply external preset (from Cmd+K compare) — nonce changes each time so
  // re-applying the same pair still triggers the update.
  useEffect(() => {
    if (!presetPair) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserTouched(true);
    setLeftId(presetPair.left);
    setRightId(presetPair.right);
  }, [presetPair?.nonce]);

  const handleLeftChange = (id: string) => { setUserTouched(true); setLeftId(id); };
  const handleRightChange = (id: string) => { setUserTouched(true); setRightId(id); };

  const leftQ = useSession(leftId || null);
  const rightQ = useSession(rightId || null);
  const left = leftQ.data;
  const right = rightQ.data;
  const sameSession = leftId === rightId && leftId !== "";

  const rows = useMemo(() => {
    if (!left || !right) return [];
    return diffSessions(left, right);
  }, [left, right]);

  const divergeIdx = rows.findIndex((r) => r.kind !== "same");
  const divergeCount = rows.filter((r) => r.kind !== "same").length;
  const summary = useMemo(() => {
    let changed = 0, added = 0, removed = 0;
    for (const r of rows) {
      if (r.kind === "changed") changed++;
      else if (r.kind === "added") added++;
      else if (r.kind === "removed") removed++;
    }
    return { changed, added, removed };
  }, [rows]);
  const loading = leftQ.isLoading || rightQ.isLoading;
  const divergeRef = useRef<HTMLDivElement>(null);

  const jumpToDivergence = () => {
    divergeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <GitCompareArrows className="h-3.5 w-3.5 text-primary" />
          Session Diff
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <SessionPicker
            value={leftId}
            onChange={handleLeftChange}
            sessions={sessions}
            label="A (baseline)"
          />
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SessionPicker
            value={rightId}
            onChange={handleRightChange}
            sessions={sessions}
            label="B (candidate)"
          />
        </div>
        {sameSession && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
            <AlertTriangle className="h-3 w-3" />
            Both pickers show the same session — diff will be identical.
          </div>
        )}
        {left && right && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
            <span className="text-muted-foreground">
              <span className="font-mono text-foreground/90">
                {left.steps.length}
              </span>{" "}
              →{" "}
              <span className="font-mono text-foreground/90">
                {right.steps.length}
              </span>{" "}
              steps
            </span>
            <span className="text-muted-foreground">
              <span className="font-mono text-foreground/90">
                {fmtDuration(left.durationMs)}
              </span>{" "}
              →{" "}
              <span className="font-mono text-foreground/90">
                {fmtDuration(right.durationMs)}
              </span>
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium",
                divergeCount === 0
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-300",
              )}
            >
              {divergeCount === 0
                ? "Identical behavior"
                : `${divergeCount} step${divergeCount > 1 ? "s" : ""} diverge`}
            </span>
            {/* Change-type breakdown */}
            {divergeCount > 0 && (
              <span className="hidden items-center gap-1.5 text-[10px] text-muted-foreground sm:inline-flex">
                {summary.changed > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    {summary.changed} changed
                  </span>
                )}
                {summary.added > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {summary.added} added
                  </span>
                )}
                {summary.removed > 0 && (
                  <span className="inline-flex items-center gap-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                    {summary.removed} removed
                  </span>
                )}
              </span>
            )}
            {divergeIdx >= 0 && (
              <button
                onClick={jumpToDivergence}
                className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10.5px] font-medium text-amber-300 transition hover:bg-amber-500/20"
                title="Scroll to the first divergent step"
              >
                <Zap className="h-3 w-3" />
                First divergence at step {divergeIdx + 1}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : !left || !right ? (
          <div className="px-4 py-12 text-center text-[12.5px] text-muted-foreground">
            Select two sessions to compare.
          </div>
        ) : (
          <div className="min-w-[640px]">
            <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-border/60 bg-background/95 backdrop-blur">
              <div className="border-r border-border/60 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                {left.name}
              </div>
              <div className="px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                {right.name}
              </div>
            </div>

            {rows.map((row, i) => {
              const l = row.left;
              const r = row.right;
              const highlight = row.kind !== "same";
              const isFirstDivergence = i === divergeIdx;
              return (
                <div
                  key={i}
                  ref={isFirstDivergence ? divergeRef : undefined}
                  className={cn(
                    "grid grid-cols-2 border-b border-border/40 scroll-mt-32",
                    highlight && "bg-amber-500/[0.04]",
                    isFirstDivergence && "bg-amber-500/[0.08] ring-1 ring-inset ring-amber-500/30",
                  )}
                >
                  <DiffCell
                    step={l}
                    kind={row.kind}
                    side="left"
                    note={highlight ? row.note : undefined}
                  />
                  <div className="border-l border-border/60">
                    <DiffCell step={r} kind={row.kind} side="right" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionPicker({
  value,
  onChange,
  sessions,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  sessions: AgentSession[];
  label: string;
}) {
  return (
    <label className="flex-1 min-w-[180px]">
      <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-border/60 bg-background/60 px-2.5 text-[12.5px] outline-none transition focus:border-primary/60"
      >
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function DiffCell({
  step,
  kind,
  side,
  note,
}: {
  step?: AgentSession["steps"][number];
  kind: "same" | "added" | "removed" | "changed";
  side: "left" | "right";
  note?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!step) {
    return (
      <div className="flex h-full items-center gap-1.5 px-4 py-3 text-[11.5px] italic text-muted-foreground/50">
        {kind === "added" && side === "left" && (
          <>
            <Minus className="h-3 w-3" /> no step here
          </>
        )}
        {kind === "removed" && side === "right" && (
          <>
            <Plus className="h-3 w-3" /> no step here
          </>
        )}
      </div>
    );
  }
  const meta = STEP_META[step.type];
  const status = STATUS_META[step.status];
  const isLong = (step.output?.length ?? 0) > COLLAPSE_THRESHOLD;
  const output = isLong && !expanded
    ? `${step.output.slice(0, COLLAPSE_THRESHOLD)}…`
    : step.output;
  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
        <span className="font-mono text-[12px] font-semibold">{step.name}</span>
        <span
          className={cn(
            "ml-auto rounded-full border px-1.5 py-px text-[9.5px] font-medium",
            status.className,
          )}
        >
          {status.label}
        </span>
      </div>
      <div className="mt-2 space-y-1.5">
        <div>
          <div className="flex items-center gap-1.5 text-[9.5px] uppercase tracking-wider text-muted-foreground/60">
            <span>Output</span>
            {isLong && (
              <button
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] font-medium text-primary/80 transition hover:bg-primary/10 hover:text-primary"
                title={expanded ? "Collapse output" : "Show full output"}
              >
                {expanded ? (
                  <>
                    <ChevronDown className="h-2.5 w-2.5" /> Less
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-2.5 w-2.5" /> More
                    <span className="opacity-60">
                      ({step.output.length} chars)
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
          <pre
            className={cn(
              "scrollbar-thin mt-0.5 overflow-auto whitespace-pre-wrap break-words rounded border border-border/50 bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-foreground/85",
              expanded ? "max-h-96" : "max-h-28",
              kind === "changed" && "border-amber-500/40",
            )}
          >
            {output}
          </pre>
        </div>
        {step.model && (
          <div className="text-[10px] text-muted-foreground">
            <span className="font-mono">{step.model}</span> ·{" "}
            {fmtDuration(step.durationMs)}
          </div>
        )}
        {note && kind !== "same" && (
          <div className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
            ← diverged
          </div>
        )}
      </div>
    </div>
  );
}
