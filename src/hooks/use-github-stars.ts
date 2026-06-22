"use client";

import { useEffect, useState } from "react";

export interface GitHubStats {
  stars: number;
  forks: number;
  url: string;
  /** True while the initial fetch is in flight. */
  loading: boolean;
}

/** Compact human-readable count: 943 → "943", 1234 → "1.2k", 1500000 → "1.5M". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v >= 100 ? Math.round(v) : Math.round(v * 10) / 10}k`;
  }
  const v = n / 1_000_000;
  return `${Math.round(v * 10) / 10}M`;
}

const FALLBACK: GitHubStats = {
  stars: 0,
  forks: 0,
  url: "https://github.com/smazzinni/replayai",
  loading: true,
};

/**
 * Fetch live GitHub repo stats from /api/github (cached server-side for 5 min).
 * Falls back gracefully — the UI always renders, even if the API is unreachable.
 */
export function useGitHubStars(): GitHubStats {
  const [stats, setStats] = useState<GitHubStats>(FALLBACK);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/github", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { stars?: number; forks?: number; url?: string }) => {
        if (cancelled) return;
        setStats({
          stars: data.stars ?? 0,
          forks: data.forks ?? 0,
          url: data.url ?? FALLBACK.url,
          loading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setStats({ ...FALLBACK, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}
