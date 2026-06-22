"use client";

import { motion } from "framer-motion";
import { Download, GitFork, Github, Package, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { GITHUB_URL, NPM_URL, PYPI_URL } from "@/lib/site-config";

interface SocialStats {
  githubStars: number;
  githubForks: number;
  npmDownloads: number;
  pypiDownloads: number;
}

function formatNum(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}k`;
  }
  const v = n / 1_000_000;
  return `${Math.round(v * 10) / 10}M`;
}

const FALLBACK: SocialStats = { githubStars: 0, githubForks: 0, npmDownloads: 0, pypiDownloads: 0 };

export function SocialProof() {
  const [stats, setStats] = useState<SocialStats>(FALLBACK);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats/social", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Partial<SocialStats>) => {
        if (cancelled) return;
        setStats({
          githubStars: d.githubStars ?? 0,
          githubForks: d.githubForks ?? 0,
          npmDownloads: d.npmDownloads ?? 0,
          pypiDownloads: d.pypiDownloads ?? 0,
        });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const items = [
    {
      icon: Star,
      label: "GitHub stars",
      value: stats.githubStars,
      href: GITHUB_URL,
      accent: "text-amber-400",
    },
    {
      icon: GitFork,
      label: "Forks",
      value: stats.githubForks,
      href: GITHUB_URL,
      accent: "text-sky-400",
    },
    {
      icon: Download,
      label: "npm downloads / week",
      value: stats.npmDownloads,
      href: NPM_URL,
      accent: "text-emerald-400",
    },
    {
      icon: Package,
      label: "PyPI downloads / week",
      value: stats.pypiDownloads,
      href: PYPI_URL,
      accent: "text-violet-400",
    },
  ];

  return (
    <section className="relative border-y border-border/40 bg-card/20">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-6 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70"
        >
          Trusted by developers building production AI
        </motion.p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <motion.a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.08 }}
                className="group relative flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border border-border/50 bg-background/40 px-4 py-5 text-center transition hover:border-primary/40 hover:bg-card/60"
              >
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 transition group-hover:opacity-100" />
                <Icon className={`h-4 w-4 ${item.accent} relative`} />
                <span className="relative font-mono text-2xl font-semibold tabular-nums text-foreground">
                  {loaded ? formatNum(item.value) : "—"}
                </span>
                <span className="relative text-[10.5px] uppercase tracking-wider text-muted-foreground">
                  {item.label}
                </span>
              </motion.a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
