import { NextResponse } from "next/server";
import { GITHUB_API_URL, GITHUB_REPO, GITHUB_URL } from "@/lib/site-config";

export const dynamic = "force-dynamic";
// Browser/CDN cache for 5 minutes, revalidate in the background.
export const revalidate = 300;

interface CachedStars {
  stars: number;
  forks: number;
  watchers: number;
  openIssues: number;
  url: string;
  fetchedAt: number;
}

// In-memory cache (per-server-instance). Short TTL so the star count stays
// reasonably fresh without hammering the GitHub API on every page load.
let cache: CachedStars | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** GET /api/github — live GitHub repo stats (stars, forks, watchers). */
export async function GET() {
  // Serve from cache when fresh.
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(
      { ...cache, cached: true, repo: GITHUB_REPO },
      {
        headers: {
          "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(GITHUB_API_URL, {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "replayai-web/1.0",
        // Optional: authenticated requests get a higher rate limit. Reads the
        // token from env if present (set GITHUB_TOKEN in production).
        ...(process.env.GITHUB_TOKEN
          ? { authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      signal: controller.signal,
      next: { revalidate: 300 },
    });
    clearTimeout(timer);

    if (!res.ok) {
      // Fall back to stale cache (if any) or a zero-count so the UI never breaks.
      if (cache) {
        return NextResponse.json(
          { ...cache, cached: true, stale: true, repo: GITHUB_REPO },
          { status: 200 },
        );
      }
      return NextResponse.json(
        {
          stars: 0,
          forks: 0,
          watchers: 0,
          openIssues: 0,
          url: GITHUB_URL,
          repo: GITHUB_REPO,
          error: `GitHub API responded ${res.status}`,
          fetchedAt: Date.now(),
        },
        { status: 200 },
      );
    }

    const data = (await res.json()) as {
      stargazers_count?: number;
      forks_count?: number;
      watchers_count?: number;
      open_issues_count?: number;
      html_url?: string;
    };

    cache = {
      stars: data.stargazers_count ?? 0,
      forks: data.forks_count ?? 0,
      watchers: data.watchers_count ?? 0,
      openIssues: data.open_issues_count ?? 0,
      url: data.html_url ?? GITHUB_URL,
      fetchedAt: Date.now(),
    };

    return NextResponse.json(
      { ...cache, cached: false, repo: GITHUB_REPO },
      {
        headers: {
          "cache-control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch {
    // Network/abort error — serve stale cache or a safe zero.
    if (cache) {
      return NextResponse.json(
        { ...cache, cached: true, stale: true, repo: GITHUB_REPO },
        { status: 200 },
      );
    }
    return NextResponse.json(
      {
        stars: 0,
        forks: 0,
        watchers: 0,
        openIssues: 0,
        url: GITHUB_URL,
        repo: GITHUB_REPO,
        error: "unreachable",
        fetchedAt: Date.now(),
      },
      { status: 200 },
    );
  }
}
