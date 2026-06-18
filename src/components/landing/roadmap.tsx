"use client";

import { motion } from "framer-motion";
import {
  CalendarCheck,
  CheckCircle2,
  Circle,
  Code,
  Megaphone,
  Rocket,
  Users,
} from "lucide-react";
import { SectionHeading } from "./problem";

const VALIDATION = [
  {
    icon: Megaphone,
    title: "Validate demand",
    body: "Post on r/LangChain & the AI Engineer Discord: “Would you use a DVR for your agent workflows? What would make you pay for it?”",
  },
  {
    icon: Code,
    title: "Ship a 50-line prototype",
    body: "Build a tracer that records one LangChain run and replays it. Record a GIF demo. Share it where the demand post went viral.",
  },
  {
    icon: Users,
    title: "Get 10 beta signups",
    body: "Before writing any production code. A waiting list of 10 teams who'd pay is the only green light you need.",
  },
];

const SPRINT = [
  { week: "Week 1–2", title: "SDK + recording core", items: ["Python & TS tracers", "LangChain decorator", "Session JSON schema", "Local storage"] },
  { week: "Week 3–4", title: "Replay engine", items: ["Tool/RAG mocking layer", "Timeline UI", "Step scrubber", "Live-LLM toggle"] },
  { week: "Week 5–6", title: "Diff + export", items: ["Side-by-side diff", "pytest generator", "jest generator", "Shareable links"] },
  { week: "Week 7–8", title: "Cloud + onboarding", items: ["Auth + cloud sync", "1-click install", "Docs site", "Design partner onboarding"] },
];

export function Roadmap() {
  return (
    <section
      id="roadmap"
      className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6"
    >
      <SectionHeading
        eyebrow="Validation & build sprint"
        title="De-risk it in a week. Ship it in two months."
        sub="No deep-tech R&D. No formal methods. Just instrumentation and UI — the kind of thing 1–2 engineers ship in 8–12 weeks for under $100K."
      />

      {/* this week */}
      <div className="mt-12">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <CalendarCheck className="h-3.5 w-3.5 text-primary" />
          Validate this week
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {VALIDATION.map((v, i) => {
            const Icon = v.icon;
            return (
              <motion.div
                key={v.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="rounded-xl border border-border/60 bg-card/50 p-5"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/25">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <h3 className="mt-3.5 text-[14.5px] font-semibold tracking-tight">
                  {v.title}
                </h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                  {v.body}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 8-week sprint */}
      <div className="mt-14">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <Rocket className="h-3.5 w-3.5 text-primary" />
          8-week MVP sprint
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {SPRINT.map((s, i) => (
            <motion.div
              key={s.week}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="relative rounded-xl border border-border/60 bg-card/40 p-5"
            >
              <div className="font-mono text-[11px] font-medium text-primary">
                {s.week}
              </div>
              <h3 className="mt-1 text-[14.5px] font-semibold tracking-tight">
                {s.title}
              </h3>
              <ul className="mt-3 space-y-1.5">
                {s.items.map((it, idx) => (
                  <li
                    key={it}
                    className="flex items-start gap-2 text-[12px] text-muted-foreground"
                  >
                    {idx === 0 && i === 0 ? (
                      <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                    ) : (
                      <Circle className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/40" />
                    )}
                    {it}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
