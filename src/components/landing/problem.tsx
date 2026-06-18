"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bug,
  Clock,
  Database,
  FileSearch,
  Repeat,
  Search,
} from "lucide-react";

const PAINS = [
  {
    icon: Clock,
    title: "“Works on my machine” — for agents",
    body: "LLMs are non-deterministic. The failure you saw in prod at 3am almost never reproduces when you re-run the same prompt locally.",
  },
  {
    icon: FileSearch,
    title: "Text-dump logs don't let you re-run",
    body: "Your existing logging tells you what happened, but you can't re-execute the exact conditions to debug. So you eyeball it. For hours.",
  },
  {
    icon: Bug,
    title: "Tool-call ordering is invisible",
    body: "Did the agent call issue_refund before or after drafting the response? Did it retry a failing tool 12 times? Good luck tracing that from JSON lines.",
  },
];

const FLOW = [
  {
    icon: Repeat,
    step: "01",
    title: "Record",
    body: "One decorator wraps your agent. Every LLM call, tool call, and retrieval is captured as a replayable session — inputs, outputs, timing, tokens.",
  },
  {
    icon: Search,
    step: "02",
    title: "Replay",
    body: "Open any session in the dashboard. Scrub the timeline like a video. Tool & RAG responses are mocked from the recording — free and 100% deterministic.",
  },
  {
    icon: Database,
    step: "03",
    title: "Diff & export",
    body: "Compare a failing run against a known-good baseline to pinpoint divergence. Export the failing session as a pytest/jest regression test in one click.",
  },
];

export function Problem() {
  return (
    <section id="problem" className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="The problem"
        title="Debugging AI agents is a time sink"
        sub="Every team shipping agents reinvents the same broken workflow: paste logs into a Slack thread, guess at the failure, re-run, repeat. It's slow, it's expensive, and it doesn't scale."
      />

      <div className="mt-12 grid gap-4 md:grid-cols-3">
        {PAINS.map((p, i) => {
          const Icon = p.icon;
          return (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="rounded-xl border border-border/60 bg-card/50 p-5"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/20">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold tracking-tight">
                {p.title}
              </h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                {p.body}
              </p>
            </motion.div>
          );
        })}
      </div>

      {/* how it works flow */}
      <div className="mt-16">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <AlertTriangle className="h-3.5 w-3.5 text-primary" />
          How ReplayAI fixes it
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {FLOW.map((f, i) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="relative rounded-xl border border-border/60 bg-gradient-to-b from-card/70 to-background/20 p-5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/25">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <span className="font-mono text-[28px] font-bold text-primary/15">
                    {f.step}
                  </span>
                </div>
                <h3 className="mt-4 text-[15px] font-semibold tracking-tight">
                  {f.title}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  sub,
  center,
}: {
  eyebrow: string;
  title: string;
  sub?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {eyebrow}
      </div>
      <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {sub && (
        <p className="mt-3 text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
          {sub}
        </p>
      )}
    </div>
  );
}
