"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Github, History, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { useGitHubStars, formatCount } from "@/hooks/use-github-stars";
import { GITHUB_URL } from "@/lib/site-config";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { label: "Demo", href: "#demo" },
  { label: "Features", href: "#features" },
  { label: "Docs", href: "/?view=developers&doc=introduction#developers" },
];

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const { stars, loading } = useGitHubStars();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border/60 bg-background/80 backdrop-blur-xl"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2">
          <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
            <History className="h-4 w-4 text-primary" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Replay<span className="text-primary">AI</span>
          </span>
        </a>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground transition hover:text-foreground hover:bg-muted/50"
            >
              {n.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Star ${GITHUB_URL} on GitHub (${stars} stars)`}
            className="hidden items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2.5 py-1.5 text-[13px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground hover:bg-muted/50 sm:inline-flex"
          >
            <Github className="h-4 w-4" />
            <Star className="h-3 w-3 fill-current text-amber-400" />
            <span className="hidden font-mono tabular-nums lg:inline">
              {loading ? "…" : formatCount(stars)}
            </span>
          </a>
          <a
            href="#demo"
            className="hidden rounded-md px-2.5 py-1.5 text-[13px] text-muted-foreground transition hover:text-foreground hover:bg-muted/50 sm:inline-flex"
          >
            Sign in
          </a>
          <ThemeToggle />
          <motion.a
            href="/?view=setup"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Get started free
          </motion.a>
        </div>
      </div>
    </header>
  );
}
