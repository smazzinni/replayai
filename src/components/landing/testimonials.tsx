"use client";

import { motion } from "framer-motion";
import { Quote } from "lucide-react";
import { SectionHeading } from "./problem";

const TESTIMONIALS = [
  {
    quote:
      "We had a LangChain agent that failed ~2% of runs in prod and nobody could reproduce it locally. ReplayAI recorded the exact failing run, we replayed it step-by-step, and found the retriever was returning stale docs on weekends. Fixed in an afternoon.",
    name: "Engineer, early-stage AI startup",
    role: "Design partner",
    initials: "AI",
  },
  {
    quote:
      "The diff view is the killer feature. We compare a passing run against a failing run and the first divergence is highlighted immediately. No more staring at JSON logs at 2am.",
    name: "Staff Engineer, SaaS platform",
    role: "Design partner",
    initials: "SP",
  },
  {
    quote:
      "Export-to-test is brilliant. Every flaky prod failure becomes a committed regression test. Our CI now catches prompt regressions before deploy — that alone justified the setup cost.",
    name: "ML Platform Lead, fintech",
    role: "Design partner",
    initials: "FP",
  },
];

export function Testimonials() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <SectionHeading
        eyebrow="From the field"
        title="Engineers waste hours on agent bugs. Here's what changes."
        sub="Real feedback from design partners using ReplayAI on production agents."
      />

      <div className="mt-12 grid gap-4 lg:grid-cols-3">
        {TESTIMONIALS.map((t, i) => (
          <motion.figure
            key={i}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
            className="group relative flex flex-col rounded-2xl border border-border/60 bg-card/50 p-6 transition hover:border-primary/40 hover:bg-card/70"
          >
            <Quote className="h-6 w-6 shrink-0 text-primary/30 transition group-hover:text-primary/50" />
            <blockquote className="mt-4 flex-1 text-[13.5px] leading-relaxed text-foreground/85">
              {t.quote}
            </blockquote>
            <figcaption className="mt-5 flex items-center gap-3 border-t border-border/40 pt-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 font-mono text-[11px] font-semibold text-primary ring-1 ring-primary/25">
                {t.initials}
              </span>
              <div className="min-w-0">
                <div className="truncate text-[12.5px] font-medium text-foreground">
                  {t.name}
                </div>
                <div className="text-[11px] text-muted-foreground">{t.role}</div>
              </div>
            </figcaption>
          </motion.figure>
        ))}
      </div>

      <p className="mt-8 text-center text-[11.5px] text-muted-foreground/70">
        Names withheld — design partners under NDA. Want to be featured here?{" "}
        <a href="#design-partners" className="text-foreground underline underline-offset-2 hover:text-primary">
          Join the program
        </a>
        .
      </p>
    </section>
  );
}
