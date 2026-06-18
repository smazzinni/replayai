"use client";

import { History } from "lucide-react";

const COLUMNS = [
  {
    title: "Product",
    links: ["Demo", "Features", "Pricing", "Roadmap", "Changelog"],
  },
  {
    title: "Developers",
    links: ["Docs", "SDK reference", "LangChain guide", "CrewAI guide", "API"],
  },
  {
    title: "Company",
    links: ["About", "Blog", "Careers", "Contact", "Security"],
  },
  {
    title: "Community",
    links: ["GitHub", "Discord", "r/LangChain", "X / Twitter", "YouTube"],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/60 bg-background/60">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <a href="#top" className="flex items-center gap-2">
              <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
                <History className="h-4 w-4 text-primary" />
              </span>
              <span className="text-[15px] font-semibold tracking-tight">
                Replay<span className="text-primary">AI</span>
              </span>
            </a>
            <p className="mt-3 max-w-xs text-[12.5px] leading-relaxed text-muted-foreground">
              DVR for AI agent workflows. Record, replay, and debug
              non-deterministic systems — the dev tool your agents deserve.
            </p>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              All systems recording
            </div>
          </div>

          {COLUMNS.map((c) => (
            <div key={c.title}>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {c.title}
              </h4>
              <ul className="mt-3 space-y-2">
                {c.links.map((l) => (
                  <li key={l}>
                    <a
                      href="#"
                      className="text-[12.5px] text-muted-foreground transition hover:text-foreground"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/50 pt-6 sm:flex-row">
          <p className="text-[11.5px] text-muted-foreground">
            © {new Date().getFullYear()} ReplayAI, Inc. Built for engineers
            tired of guessing.
          </p>
          <div className="flex items-center gap-4 text-[11.5px] text-muted-foreground">
            <a href="#" className="transition hover:text-foreground">
              Privacy
            </a>
            <a href="#" className="transition hover:text-foreground">
              Terms
            </a>
            <a href="#" className="transition hover:text-foreground">
              SOC 2
            </a>
            <span className="font-mono">v0.4.1</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
