"use client";

import { cn } from "@/lib/utils";
import {
  fmtDuration,
  fmtOffset,
  SESSIONS,
  STEP_META,
  STATUS_META,
  type AgentSession,
  type SessionStep,
} from "@/lib/replay-data";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  FastForward,
  Pause,
  Play,
  RotateCcw,
  Terminal,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { CodeBlock } from "./code-block";

interface ReplayTimelineProps {
  session: AgentSession;
}

export function ReplayTimeline({ session }: ReplayTimelineProps) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [replayLlm, setReplayLlm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = session.steps[index];
  const total = session.steps.length;
  const progress = ((index + 1) / total) * 100;

  const advance = useCallback(() => {
    setIndex((i) => {
      if (i + 1 >= total) {
        setPlaying(false);
        return i;
      }
      return i + 1;
    });
  }, [total]);

  useEffect(() => {
    if (!playing) return;
    const dur = Math.max(700, Math.min(2400, step?.durationMs ?? 1000));
    timerRef.current = setTimeout(advance, dur);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, index, step, advance]);

  const restart = () => {
    setIndex(0);
    setPlaying(false);
  };

  const stepTo = (i: number) => {
    setIndex(Math.max(0, Math.min(total - 1, i)));
    setPlaying(false);
  };

  // build proportional segment widths from durations
  const totalDur = session.steps.reduce((a, s) => a + s.durationMs, 0) || 1;

  return (
    <div className="flex h-full flex-col">
      {/* Session header */}
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
                  session.status === "failed"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    session.status === "failed" ? "bg-rose-400" : "bg-emerald-400",
                  )}
                />
                {session.status === "failed" ? "Failed" : "Succeeded"}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {session.id}
              </span>
            </div>
            <h3 className="mt-1.5 truncate text-[15px] font-semibold tracking-tight">
              {session.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              <span className="font-mono">{session.agent}</span>
              <span className="opacity-40">·</span>
              <span>{session.framework}</span>
              <span className="opacity-40">·</span>
              <span>{fmtDuration(session.durationMs)}</span>
              <span className="opacity-40">·</span>
              <span>{session.tokenTotal.toLocaleString()} tok</span>
              <span className="opacity-40">·</span>
              <span>{fmtOffset(session.durationMs).replace("+", "ended +")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline scrubber */}
      <div className="border-b border-border/60 px-4 py-3">
        <div className="mb-2 flex items-center justify-between text-[10.5px] text-muted-foreground">
          <span className="font-mono">
            Step {index + 1} / {total}
          </span>
          <span className="font-mono">
            {fmtOffset(step?.t ?? 0)} · {fmtDuration(step?.durationMs ?? 0)}
          </span>
        </div>

        {/* proportional segments */}
        <div className="relative">
          <div className="flex h-9 w-full gap-px overflow-hidden rounded-md border border-border/60 bg-background/40 p-px">
            {session.steps.map((s, i) => {
              const meta = STEP_META[s.type];
              const w = Math.max(2, (s.durationMs / totalDur) * 100);
              const isActive = i === index;
              const isPast = i < index;
              return (
                <button
                  key={s.id}
                  onClick={() => stepTo(i)}
                  title={`${s.name} · ${fmtDuration(s.durationMs)}`}
                  style={{ width: `${w}%` }}
                  className={cn(
                    "group/seg relative flex h-full items-center justify-center overflow-hidden rounded-sm transition-all",
                    isActive
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      : "",
                  )}
                >
                  <div
                    className={cn(
                      "h-full w-full transition-opacity",
                      meta.dot,
                      isActive
                        ? "opacity-100"
                        : isPast
                          ? "opacity-60"
                          : "opacity-25 group-hover/seg:opacity-50",
                    )}
                  />
                  {isActive && (
                    <motion.span
                      layoutId="seg-cursor"
                      className="absolute inset-0 rounded-sm ring-2 ring-primary"
                    />
                  )}
                </button>
              );
            })}
          </div>
          {/* progress line under */}
          <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full bg-primary"
              animate={{ width: `${progress}%` }}
              transition={{ type: "spring", stiffness: 200, damping: 30 }}
            />
          </div>
        </div>

        {/* transport controls */}
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={restart}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 px-2.5 text-[12px] text-muted-foreground transition hover:text-foreground hover:bg-muted/60"
            title="Restart"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => stepTo(index - 1)}
            disabled={index === 0}
            className="inline-flex h-8 items-center justify-center rounded-md border border-border/60 px-2 text-muted-foreground transition hover:text-foreground hover:bg-muted/60 disabled:opacity-40 disabled:hover:bg-transparent"
            title="Previous step"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (index >= total - 1) {
                restart();
                return;
              }
              setPlaying((p) => !p);
            }}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            {playing ? (
              <>
                <Pause className="h-4 w-4" /> Pause
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> {index >= total - 1 ? "Replay" : "Play"}
              </>
            )}
          </button>
          <button
            onClick={() => stepTo(index + 1)}
            disabled={index >= total - 1}
            className="inline-flex h-8 items-center justify-center rounded-md border border-border/60 px-2 text-muted-foreground transition hover:text-foreground hover:bg-muted/60 disabled:opacity-40 disabled:hover:bg-transparent"
            title="Next step"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setReplayLlm((v) => !v)}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[11.5px] font-medium transition",
                replayLlm
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-border/60 text-muted-foreground hover:text-foreground",
              )}
              title="When off, LLM calls are mocked from recording (deterministic, $0). When on, real LLM calls run (costs money)."
            >
              <Zap className="h-3.5 w-3.5" />
              {replayLlm ? "Live LLM" : "Mocked LLM"}
            </button>
            <span className="hidden text-[10.5px] text-muted-foreground sm:inline">
              {replayLlm ? "~$" + (session.costUsd * 1).toFixed(3) + "/run" : "$0.000/run"}
            </span>
          </div>
        </div>
      </div>

      {/* Step detail */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step?.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="p-4"
          >
            <StepDetail step={step!} replayLlm={replayLlm} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function StepDetail({
  step,
  replayLlm,
}: {
  step: SessionStep;
  replayLlm: boolean;
}) {
  const meta = STEP_META[step.type];
  const status = STATUS_META[step.status];

  const isMockedLlm = step.type === "llm_call" && !replayLlm;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] font-medium",
            meta.color,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
          {meta.label}
        </span>
        <h4 className="font-mono text-[13.5px] font-semibold tracking-tight">
          {step.name}
        </h4>
        <span
          className={cn(
            "ml-auto rounded-full border px-2 py-0.5 text-[10.5px] font-medium",
            status.className,
          )}
        >
          {status.label}
        </span>
      </div>

      <div className="grid gap-2 text-[11px] text-muted-foreground sm:grid-cols-4">
        {step.model && (
          <div className="rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5">
            <div className="text-[9.5px] uppercase tracking-wider opacity-60">
              Model
            </div>
            <div className="font-mono text-foreground/90">{step.model}</div>
          </div>
        )}
        <div className="rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5">
          <div className="text-[9.5px] uppercase tracking-wider opacity-60">
            Duration
          </div>
          <div className="font-mono text-foreground/90">
            {fmtDuration(step.durationMs)}
          </div>
        </div>
        {step.tokensIn != null && (
          <div className="rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5">
            <div className="text-[9.5px] uppercase tracking-wider opacity-60">
              Tokens
            </div>
            <div className="font-mono text-foreground/90">
              {step.tokensIn}→{step.tokensOut}
            </div>
          </div>
        )}
        <div className="rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5">
          <div className="text-[9.5px] uppercase tracking-wider opacity-60">
            Offset
          </div>
          <div className="font-mono text-foreground/90">{fmtOffset(step.t)}</div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            <Terminal className="h-3 w-3" /> Input
          </div>
          <CodeBlock code={step.input} language="input" maxHeight="max-h-64" />
        </div>
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            <FastForward className="h-3 w-3" /> Output
            {isMockedLlm && (
              <span className="ml-auto inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-px text-[9.5px] font-medium text-emerald-300">
                <RotateCcw className="h-2.5 w-2.5" /> replayed from recording
              </span>
            )}
          </div>
          <CodeBlock
            code={step.output}
            language="output"
            maxHeight="max-h-64"
            className={cn(
              step.status === "failed" &&
                "border-rose-500/40 bg-rose-950/20",
            )}
          />
        </div>
      </div>

      <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
        {step.type === "tool_call" && (
          <>
            <span className="font-medium text-foreground/80">Replay behavior:</span>{" "}
            This tool call is{" "}
            <span className="text-emerald-300">mocked from the recording</span> —
            no network call is made, so the replay is fully deterministic and
            free.
          </>
        )}
        {step.type === "llm_call" && (
          <>
            <span className="font-medium text-foreground/80">Replay behavior:</span>{" "}
            {replayLlm ? (
              <>
                Live mode — the LLM is{" "}
                <span className="text-amber-300">re-invoked</span> with the
                recorded input. Useful for testing prompt changes, but output may
                differ and costs apply.
              </>
            ) : (
              <>
                This LLM response is{" "}
                <span className="text-emerald-300">replayed from the recording</span>{" "}
                — identical bytes every time. Toggle{" "}
                <span className="text-amber-300">Live LLM</span> to re-run it.
              </>
            )}
          </>
        )}
        {step.type === "retrieval" && (
          <>
            <span className="font-medium text-foreground/80">Replay behavior:</span>{" "}
            Retrieved chunks are{" "}
            <span className="text-emerald-300">served from the recording</span>{" "}
            — no embedding or vector DB call is made.
          </>
        )}
        {step.type === "decision" && (
          <>
            <span className="font-medium text-foreground/80">Replay behavior:</span>{" "}
            Routing decision is{" "}
            <span className="text-emerald-300">replayed verbatim</span> — branch
            taken is identical to the original run.
          </>
        )}
        {step.type === "error" && (
          <>
            <span className="font-medium text-rose-300">Failure analysis:</span>{" "}
            This error is{" "}
            <span className="text-emerald-300">reproduced deterministically</span>{" "}
            on every replay — no more "works on my machine".
          </>
        )}
      </div>
    </div>
  );
}

// re-export for convenience in dashboard
export { SESSIONS };
