"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Circle,
  Clock,
  Coins,
  type LucideIcon,
  Play,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { CodeBlock } from "@/components/replay/code-block";
import { useEffect, useState } from "react";
import { useMounted } from "@/hooks/use-mounted";

const SNIPPET = `from replayai import trace

# Wrap any agent run — records every LLM & tool call
with trace("support-agent-v3"):
    result = agent.run(user_message)

# Failed? Open the session in the dashboard and replay it
# step-by-step. Mocks are served from the recording.

>>> session ses_8fa1 recorded (8 steps, 18.4s)
>>> open  https://app.replayai.dev/s/ses_8fa1`;

const FRAMEWORKS = ["LangChain", "LlamaIndex", "CrewAI", "OpenAI SDK", "Anthropic", "AutoGen"];

export function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      {/* grid bg */}
      <div className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-60" />
      {/* glow */}
      <div className="pointer-events-none absolute left-1/2 top-[-10%] h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />

      <div className="relative mx-auto max-w-6xl px-4 pt-16 pb-10 sm:px-6 sm:pt-24 lg:pt-28">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          {/* left */}
          <div>
            <motion.a
              href="#demo"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 py-1 pl-1 pr-3 text-[12px] text-muted-foreground backdrop-blur transition hover:border-primary/40"
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10.5px] font-semibold text-primary">
                <Sparkles className="h-3 w-3" /> New
              </span>
              DVR for AI Agent Workflows
              <ArrowRight className="h-3 w-3" />
            </motion.a>

            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
              className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-[56px]"
            >
              Stop replaying bugs
              <br />
              in your head.{" "}
              <span className="text-glow text-primary">Replay them</span>{" "}
              <span className="relative">
                for real.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12 }}
              className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground sm:text-base"
            >
              When an AI agent fails, engineers waste hours trying to reproduce
              the exact sequence of prompts, tool calls, and context that broke
              it. ReplayAI records every run as a fully replayable session —
              scrub, diff, and export failing runs as deterministic tests.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.18 }}
              className="mt-7 flex flex-wrap items-center gap-3"
            >
              <a
                href="#demo"
                className="group inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
              >
                <Play className="h-4 w-4 fill-current" />
                Try the live demo
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-4 py-2.5 text-[14px] font-medium text-foreground/90 backdrop-blur transition hover:bg-muted/40"
              >
                <Terminal className="h-4 w-4 text-primary" />
                See how it works
              </a>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8"
            >
              <div className="text-[10.5px] uppercase tracking-wider text-muted-foreground/60">
                Integrates in &lt;1 hour with
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
                {FRAMEWORKS.map((f) => (
                  <span
                    key={f}
                    className="font-mono text-[12.5px] text-muted-foreground/80"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>

          {/* right — terminal card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* layered glow: primary + a subtle violet accent */}
            <div className="absolute -inset-3 rounded-3xl bg-primary/10 blur-2xl" />
            <div className="absolute -inset-3 rounded-3xl bg-gradient-to-tr from-primary/5 via-transparent to-violet-500/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card/80 shadow-2xl shadow-black/50 backdrop-blur">
              {/* gradient top border accent */}
              <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="flex items-center gap-2 border-b border-border/60 bg-background/50 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-500/70 transition hover:bg-rose-500" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70 transition hover:bg-amber-500" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70 transition hover:bg-emerald-500" />
                </div>
                <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                  agent_run.py — replayai
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10.5px] font-medium text-rose-300">
                  <Circle className="rec-dot h-2 w-2 fill-current" />
                  REC
                </span>
                <LiveRecordedBadge />
              </div>
              <div className="p-3">
                <CodeBlock
                  code={SNIPPET}
                  language="python"
                  maxHeight="max-h-[360px]"
                  showCopy={false}
                />
              </div>
              <div className="grid grid-cols-3 gap-px border-t border-border/60 bg-border/30 text-center">
                <MiniStat value="8" label="steps" icon={Sparkles} />
                <MiniStat value="18.4s" label="duration" icon={Clock} />
                <MiniStat value="$0.09" label="cost" icon={Coins} />
              </div>
            </div>
          </motion.div>
        </div>

        {/* trust strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-14 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-y border-border/40 py-5 text-center"
        >
          {[
            { v: "10×", l: "faster root-cause", icon: Zap },
            { v: "$0", l: "to replay a run", icon: Coins },
            { v: "100%", l: "deterministic", icon: Sparkles },
            { v: "<1 hr", l: "to integrate", icon: Clock },
          ].map(({ v, l, icon: Icon }) => (
            <div key={l} className="flex items-center gap-2">
              <Icon className="h-3.5 w-3.5 text-primary/60" />
              <span className="text-xl font-semibold text-primary">{v}</span>
              <span className="text-[12.5px] text-muted-foreground">{l}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function MiniStat({
  value,
  label,
  icon: Icon,
}: {
  value: string;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <div className="group bg-background/60 px-3 py-2 transition hover:bg-background/80">
      <div className="flex items-center justify-center gap-1">
        <Icon className="h-3 w-3 text-primary/50" />
        <div className="font-mono text-[15px] font-semibold text-primary">
          {value}
        </div>
      </div>
      <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

/** Live "recorded Xs ago" badge — updates every second, reinforces the DVR concept. */
function LiveRecordedBadge() {
  // Use a stable placeholder on the server + first client render to avoid
  // hydration mismatches; only start the random + interval after mount.
  const mounted = useMounted();
  const [seconds, setSeconds] = useState(3);
  useEffect(() => {
    // Start from a random recent offset (3-8s) so it feels fresh on each load.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeconds(3 + Math.floor(Math.random() * 6));
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const label =
    seconds < 60
      ? `${seconds}s ago`
      : `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
  return (
    <span
      className="hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] text-primary/80 sm:inline-flex"
      suppressHydrationWarning
    >
      <Clock className="rec-clock h-2.5 w-2.5" />
      {mounted ? `recorded ${label}` : "recorded just now"}
    </span>
  );
}
