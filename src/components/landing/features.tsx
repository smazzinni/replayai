"use client";

import { motion } from "framer-motion";
import {
  Boxes,
  Code2,
  GitCompareArrows,
  Layers,
  Plug,
  Repeat,
  ScrollText,
  TerminalSquare,
} from "lucide-react";
import { SectionHeading } from "./problem";

const FEATURES = [
  {
    icon: Repeat,
    title: "Deterministic replay",
    tag: "Core",
    body: "Re-run any recorded session with tool & RAG responses mocked from the recording. Identical bytes, every time, $0 cost. Opt-in to re-invoke real LLM calls when you want to test prompt changes.",
    bullets: ["Mocked tools & retrieval", "Toggle live LLM per run", "Reproduces prod failures exactly"],
  },
  {
    icon: Layers,
    title: "Visual timeline",
    tag: "Core",
    body: "Every step — LLM call, tool call, retrieval, decision — rendered as a proportional, color-coded timeline. Scrub like a video. See call ordering, durations, and failures at a glance.",
    bullets: ["Proportional step segments", "Per-step input/output", "Token & cost breakdown"],
  },
  {
    icon: GitCompareArrows,
    title: "Diff view",
    tag: "Core",
    body: "Compare two sessions side-by-side to find exactly where behavior diverged. Spot the one tool call that returned null and sent the agent into a retry loop.",
    bullets: ["Side-by-side step alignment", "First-divergence detection", "Status & output delta"],
  },
  {
    icon: Code2,
    title: "Export to test",
    tag: "Core",
    body: "One click turns a failing session into a runnable pytest or jest regression test. Mocks are extracted automatically. Commit it and CI catches the regression forever.",
    bullets: ["pytest & jest output", "Auto-extracted mocks", "Asserts against recorded baseline"],
  },
  {
    icon: Plug,
    title: "Framework integrations",
    tag: "Integration",
    body: "Wrap LangChain, LlamaIndex, CrewAI, or a custom agent in a single decorator. No code changes to your agent logic — just instrumentation.",
    bullets: ["LangChain / LlamaIndex / CrewAI", "OpenAI & Anthropic SDKs", "Custom agents via context manager"],
  },
  {
    icon: Boxes,
    title: "Team sessions & sharing",
    tag: "Collab",
    body: "Share a deep link to a recorded session so a teammate can replay it in their browser — no env setup, no API keys. Perfect for async debugging and on-call handoffs.",
    bullets: ["Shareable session links", "Comments on steps", "On-call replay handoffs"],
  },
  {
    icon: ScrollText,
    title: "Audit & compliance",
    tag: "Enterprise",
    body: "Immutable, timestamped records of every agent decision. Built for SOC 2 and AI-governance requirements. Export to S3 or run fully on-prem.",
    bullets: ["Immutable recordings", "SOC 2 ready", "On-prem deployment"],
  },
  {
    icon: TerminalSquare,
    title: "CLI & CI",
    tag: "Workflow",
    body: "replayai record in your runtime, replayai test in CI. Surface regressions on every PR before they hit prod. Integrates with GitHub Actions, GitLab CI, Jenkins.",
    bullets: ["GitHub Actions integration", "PR regression reports", "Pre-deploy replay gates"],
  },
];

export function Features() {
  return (
    <section id="features" className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="Features"
        title="Everything you need to debug non-deterministic systems"
        sub="No formal verification. No eBPF. No custom solvers. Just good old-fashioned instrumentation and a UI engineers actually want to use."
      />

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: (i % 4) * 0.06 }}
              className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card/50 p-5 transition duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/70 hover:shadow-[0_8px_30px_-12px_oklch(0.72_0.16_162/0.35)]"
            >
              {/* gradient glow on hover */}
              <div className="pointer-events-none absolute -inset-px -z-10 rounded-xl bg-gradient-to-br from-primary/15 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
              <div className="flex items-center justify-between">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/25 transition duration-300 group-hover:bg-primary/15 group-hover:ring-primary/40">
                  <Icon className="h-4.5 w-4.5" />
                  {/* icon glow */}
                  <div className="pointer-events-none absolute inset-0 rounded-lg bg-primary/20 opacity-0 blur-md transition group-hover:opacity-100" />
                </div>
                <span className="rounded-full border border-border/60 bg-background/40 px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground transition group-hover:border-primary/30 group-hover:text-primary/80">
                  {f.tag}
                </span>
              </div>
              <h3 className="mt-4 text-[14.5px] font-semibold tracking-tight">
                {f.title}
              </h3>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                {f.body}
              </p>
              <ul className="mt-3 space-y-1 border-t border-border/40 pt-3">
                {f.bullets.map((b) => (
                  <li
                    key={b}
                    className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground/90"
                  >
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-primary/70 transition group-hover:bg-primary" />
                    {b}
                  </li>
                ))}
              </ul>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
