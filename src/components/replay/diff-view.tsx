"use client";

import { cn } from "@/lib/utils";
import {
  diffSessions,
  fmtDuration,
  STEP_META,
  STATUS_META,
  type AgentSession,
} from "@/lib/replay-data";
import { ArrowRight, GitCompareArrows, Minus, Plus } from "lucide-react";
import { useMemo, useState } from "react";

interface DiffViewProps {
  sessions: AgentSession[];
}

export function DiffView({ sessions }: DiffViewProps) {
  const [leftId, setLeftId] = useState(sessions[0]?.id ?? "");
  const [rightId, setRightId] = useState(sessions[1]?.id ?? "");

  const left = sessions.find((s) => s.id === leftId);
  const right = sessions.find((s) => s.id === rightId);

  const rows = useMemo(() => {
    if (!left || !right) return [];
    return diffSessions(left, right);
  }, [left, right]);

  const divergeIdx = rows.findIndex((r) => r.kind !== "same");
  const divergeCount = rows.filter((r) => r.kind !== "same").length;

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
            onChange={setLeftId}
            sessions={sessions}
            label="A (baseline)"
          />
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          <SessionPicker
            value={rightId}
            onChange={setRightId}
            sessions={sessions}
            label="B (candidate)"
          />
        </div>
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
            {divergeIdx >= 0 && (
              <span className="text-muted-foreground">
                First divergence at{" "}
                <span className="font-mono text-foreground/90">
                  step {divergeIdx + 1}
                </span>
              </span>
            )}
          </div>
        )}
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="min-w-[640px]">
          {/* header row */}
          <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-border/60 bg-background/95 backdrop-blur">
            <div className="border-r border-border/60 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              {left?.name ?? "—"}
            </div>
            <div className="px-4 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
              {right?.name ?? "—"}
            </div>
          </div>

          {rows.map((row, i) => {
            const l = row.left;
            const r = row.right;
            const highlight = row.kind !== "same";
            return (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-2 border-b border-border/40",
                  highlight && "bg-amber-500/[0.04]",
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
          <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground/60">
            Output
          </div>
          <pre
            className={cn(
              "scrollbar-thin mt-0.5 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded border border-border/50 bg-black/30 p-2 font-mono text-[11px] leading-relaxed text-foreground/85",
              kind === "changed" && "border-amber-500/40",
            )}
          >
            {step.output}
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
