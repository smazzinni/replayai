import { NextResponse } from "next/server";
import { GITHUB_URL, NPM_URL, PYPI_URL } from "@/lib/site-config";

export const dynamic = "force-dynamic";
export const revalidate = 3600; // 1 hour

interface Stats {
  githubStars: number;
  githubForks: number;
  npmDownloads: number;
  pypiDownloads: number;
  fetchedAt: number;
}

let cache: (Stats & { cached: boolean }) | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/** GET /api/stats/social — live social-proof numbers (GitHub stars + package downloads). */
export async function GET() {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ ...cache, cached: true });
  }

  const [github, npm, pypi] = await Promise.allSettled([
    fetchGitHub(),
    fetchNpmDownloads(),
    fetchPypiDownloads(),
  ]);

  const result: Stats = {
    githubStars: github.status === "fulfilled" ? github.value.stars : 0,
    githubForks: github.status === "fulfilled" ? github.value.forks : 0,
    npmDownloads: npm.status === "fulfilled" ? npm.value : 0,
    pypiDownloads: pypi.status === "fulfilled" ? pypi.value : 0,
    fetchedAt: Date.now(),
  };

  cache = { ...result, cached: false };
  return NextResponse.json(
    { ...result, cached: false, links: { github: GITHUB_URL, npm: NPM_URL, pypi: PYPI_URL } },
    { headers: { "cache-control": "public, s-maxage=3600, stale-while-revalidate=7200" } },
  );
}

async function fetchGitHub(): Promise<{ stars: number; forks: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch("https://api.github.com/repos/smazzinni/replayai", {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "replayai-web/1.0",
        ...(process.env.GITHUB_TOKEN
          ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { stars: 0, forks: 0 };
    const data = await res.json();
    return {
      stars: data.stargazers_count ?? 0,
      forks: data.forks_count ?? 0,
    };
  } catch {
    clearTimeout(timer);
    return { stars: 0, forks: 0 };
  }
}

/** npm downloads in the last week (npm registry API). */
async function fetchNpmDownloads(): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      "https://api.npmjs.org/downloads/point/last-week/@smazzinni/sdk",
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return 0;
    const data = await res.json();
    return data.downloads ?? 0;
  } catch {
    clearTimeout(timer);
    return 0;
  }
}

/** PyPI downloads (via pypistats.org — last 7 days). */
async function fetchPypiDownloads(): Promise<number> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(
      "https://pypistats.org/api/packages/replayai-sdk/recent",
      { signal: controller.signal },
    );
    clearTimeout(timer);
    if (!res.ok) return 0;
    const data = await res.json();
    return data?.data?.last_week ?? 0;
  } catch {
    clearTimeout(timer);
    return 0;
  }
}
