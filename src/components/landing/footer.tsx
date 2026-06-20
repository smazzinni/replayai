"use client";

import { History } from "lucide-react";

interface LinkDef {
  label: string;
  href: string;
  external?: boolean;
}

interface Column {
  title: string;
  links: LinkDef[];
}

const COLUMNS: Column[] = [
  {
    title: "Product",
    links: [
      { label: "Demo", href: "/#demo" },
      { label: "Features", href: "/#features" },
      { label: "Setup", href: "/?view=setup" },
    ],
  },
  {
    title: "Developers",
    links: [
      { label: "Docs", href: "/?view=developers&doc=introduction#developers" },
      { label: "SDK reference", href: "/?view=developers&doc=sdk-python#developers" },
      { label: "LangChain guide", href: "/?view=developers&doc=langchain#developers" },
      { label: "CrewAI guide", href: "/?view=developers&doc=crewai#developers" },
      { label: "API", href: "/?view=developers&doc=api-overview#developers" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/#" },
      { label: "Blog", href: "/#" },
      { label: "Careers", href: "/#" },
      { label: "Contact", href: "/#" },
      { label: "Security", href: "/#" },
    ],
  },
  {
    title: "Community",
    links: [
      { label: "GitHub", href: "/#", external: true },
      { label: "Discord", href: "/#", external: true },
      { label: "r/LangChain", href: "/#", external: true },
      { label: "X / Twitter", href: "/#", external: true },
      { label: "YouTube", href: "/#", external: true },
    ],
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
            <a
              href="/?view=developers&doc=quickstart#developers"
              className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/60 px-2.5 py-1.5 text-[11.5px] font-medium text-foreground/90 transition hover:border-primary/40 hover:text-primary"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Read the docs →
            </a>
          </div>

          {COLUMNS.map((c) => (
            <div key={c.title}>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {c.title}
              </h4>
              <ul className="mt-3 space-y-2">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[12.5px] text-muted-foreground transition hover:text-foreground"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border/50 pt-6 sm:flex-row">
          <p className="text-[11.5px] text-muted-foreground" suppressHydrationWarning>
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
