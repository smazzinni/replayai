"use client";

import { motion } from "framer-motion";
import { ArrowRight, Github, Star, Terminal } from "lucide-react";
import { CodeBlock } from "@/components/replay/code-block";
import { useGitHubStars, formatCount } from "@/hooks/use-github-stars";
import { GITHUB_URL } from "@/lib/site-config";

const INSTALL = `# 1. Install the SDK
pip install replayai-sdk
# or
npm install @smazzinni/sdk

# 2. Wrap your agent — that's it
replayai trace ./agent.py

# 3. Open the dashboard
replayai ui  →  http://localhost:7373`;

export function CTA() {
  const { stars, loading } = useGitHubStars();
  return (
    <section id="cta" className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-grid bg-grid-fade opacity-40" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[360px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-[120px]" />

      <div className="relative mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 backdrop-blur sm:p-10">
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4 }}
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
                  <span className="rec-dot h-1.5 w-1.5 rounded-full bg-rose-500" />
                  Start recording in 60 seconds
                </div>
                <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                  Your next 3am agent fire
                  <br />
                  won&apos;t be a mystery.
                </h2>
                <p className="mt-3 text-[14.5px] leading-relaxed text-muted-foreground">
                  Install the SDK, wrap your agent, and every run becomes a
                  replayable session. Free up to 100 sessions a month — no credit
                  card.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="#demo"
                    className="group inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90"
                  >
                    <Terminal className="h-4 w-4" />
                    Get started free
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </a>
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 px-4 py-2.5 text-[14px] font-medium text-foreground/90 transition hover:border-primary/40 hover:bg-muted/40"
                  >
                    <Github className="h-4 w-4" />
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    Star on GitHub
                    <span className="font-mono text-[12.5px] tabular-nums text-muted-foreground">
                      {loading ? "…" : formatCount(stars)}
                    </span>
                  </a>
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <CodeBlock
                code={INSTALL}
                language="bash"
                maxHeight="max-h-[280px]"
              />
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
