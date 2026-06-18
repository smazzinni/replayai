"use client";

import { cn } from "@/lib/utils";
import { DOC_NAV, DOC_ORDER, DOCS } from "@/lib/docs-content";
import { extractToc } from "@/lib/docs-utils";
import {
  ArrowLeft,
  ChevronRight,
  Command,
  History,
  Search,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Markdown } from "./markdown";

interface DocsAppProps {
  initialDoc?: string;
}

export function DocsApp({ initialDoc }: DocsAppProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [docSlug, setDocSlug] = useState(initialDoc ?? "introduction");
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const doc = DOCS[docSlug] ?? DOCS.introduction;
  const toc = useMemo(() => extractToc(doc.content), [doc.content]);

  // Navigate to a doc, updating the URL.
  const goTo = useCallback(
    (slug: string) => {
      setDocSlug(slug);
      setMobileNavOpen(false);
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", "developers");
      params.set("doc", slug);
      router.replace(`/?${params.toString()}#developers`, { scroll: false });
      // scroll content to top on doc change
      requestAnimationFrame(() => {
        contentRef.current?.scrollTo({ top: 0, behavior: "instant" });
        window.scrollTo({ top: 0, behavior: "instant" });
      });
    },
    [router, searchParams],
  );

  // Keyboard: cmd/ctrl+k to open search, esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      } else if (e.key === "Escape") {
        setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const orderIdx = DOC_ORDER.indexOf(docSlug);
  const prev = orderIdx > 0 ? DOCS[DOC_ORDER[orderIdx - 1]] : null;
  const next =
    orderIdx >= 0 && orderIdx < DOC_ORDER.length - 1
      ? DOCS[DOC_ORDER[orderIdx + 1]]
      : null;

  const backToApp = () => {
    router.push("/");
  };

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              backToApp();
            }}
            className="flex items-center gap-2"
          >
            <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
              <History className="h-4 w-4 text-primary" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Replay<span className="text-primary">AI</span>
            </span>
            <span className="ml-1 hidden rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
              Docs
            </span>
          </a>

          <button
            onClick={() => setSearchOpen(true)}
            className="group ml-2 hidden h-8 flex-1 max-w-md items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 text-[12.5px] text-muted-foreground transition hover:border-border sm:flex"
          >
            <Search className="h-3.5 w-3.5" />
            <span>Search docs…</span>
            <kbd className="ml-auto inline-flex items-center gap-0.5 rounded border border-border/60 bg-background/60 px-1.5 py-px font-mono text-[10px]">
              <Command className="h-2.5 w-2.5" />K
            </kbd>
          </button>

          <button
            onClick={() => setMobileNavOpen(true)}
            className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md border border-border/60 px-2.5 text-[12.5px] text-muted-foreground transition hover:text-foreground sm:hidden"
          >
            <ChevronRight className="h-3.5 w-3.5" /> Menu
          </button>

          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              backToApp();
            }}
            className="ml-auto hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] text-muted-foreground transition hover:text-foreground sm:inline-flex"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to app
          </a>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1">
        {/* Sidebar */}
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-border/60 px-4 py-6 scrollbar-thin md:block">
          <DocsNav activeSlug={docSlug} onSelect={goTo} />
        </aside>

        {/* Mobile sidebar drawer */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto border-r border-border/60 bg-background p-4 scrollbar-thin">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-[13px] font-semibold">Navigation</span>
                <button
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <DocsNav activeSlug={docSlug} onSelect={goTo} />
            </div>
          </div>
        )}

        {/* Content */}
        <main className="min-w-0 flex-1">
          <div
            ref={contentRef}
            className="mx-auto max-w-3xl px-5 pb-24 pt-10 sm:px-8"
          >
            {/* breadcrumb */}
            <div className="mb-4 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
              <span>Developers</span>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span>{doc.category}</span>
              <ChevronRight className="h-3 w-3 opacity-50" />
              <span className="text-foreground/80">{doc.title}</span>
            </div>

            <Markdown content={doc.content} />

            {/* prev/next pager */}
            <nav className="mt-12 grid gap-3 border-t border-border/60 pt-6 sm:grid-cols-2">
              {prev ? (
                <button
                  onClick={() => goTo(prev.slug)}
                  className="group flex flex-col items-start rounded-lg border border-border/60 bg-card/40 px-4 py-3 text-left transition hover:border-primary/40 hover:bg-card/70"
                >
                  <span className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    <ArrowLeft className="h-3 w-3" /> Previous
                  </span>
                  <span className="mt-1 text-[13.5px] font-medium group-hover:text-primary">
                    {prev.title}
                  </span>
                </button>
              ) : (
                <span />
              )}
              {next ? (
                <button
                  onClick={() => goTo(next.slug)}
                  className="group flex flex-col items-end rounded-lg border border-border/60 bg-card/40 px-4 py-3 text-right transition hover:border-primary/40 hover:bg-card/70"
                >
                  <span className="flex items-center gap-1 text-[10.5px] uppercase tracking-wider text-muted-foreground">
                    Next <ChevronRight className="h-3 w-3" />
                  </span>
                  <span className="mt-1 text-[13.5px] font-medium group-hover:text-primary">
                    {next.title}
                  </span>
                </button>
              ) : (
                <span />
              )}
            </nav>

            <p className="mt-8 text-center text-[11.5px] text-muted-foreground">
              Was this page helpful?{" "}
              <a
                href="#"
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                Edit on GitHub
              </a>{" "}
              ·{" "}
              <a
                href="#"
                className="text-foreground underline underline-offset-2 hover:text-primary"
              >
                Suggest changes
              </a>
            </p>
          </div>
        </main>

        {/* On this page */}
        {toc.length > 0 && (
          <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto px-4 py-6 scrollbar-thin lg:block">
            <OnThisPage toc={toc} />
          </aside>
        )}
      </div>

      {/* Search dialog */}
      {searchOpen && (
        <SearchDialog
          onClose={() => setSearchOpen(false)}
          onSelect={(slug) => {
            goTo(slug);
            setSearchOpen(false);
          }}
        />
      )}
    </div>
  );
}

function DocsNav({
  activeSlug,
  onSelect,
}: {
  activeSlug: string;
  onSelect: (slug: string) => void;
}) {
  return (
    <nav className="space-y-6">
      {DOC_NAV.map((cat) => (
        <div key={cat.category}>
          <div className="mb-1.5 px-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {cat.category}
          </div>
          <ul className="space-y-0.5">
            {cat.pages.map((p) => {
              const active = p.slug === activeSlug;
              return (
                <li key={p.slug}>
                  <button
                    onClick={() => onSelect(p.slug)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                    )}
                  >
                    <span className="truncate">{p.title}</span>
                    {p.badge && (
                      <span className="ml-auto shrink-0 rounded bg-primary/15 px-1.5 py-px text-[9px] font-medium uppercase tracking-wide text-primary">
                        {p.badge}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function OnThisPage({ toc }: { toc: { id: string; text: string; level: 2 | 3 }[] }) {
  const [activeId, setActiveId] = useState<string>(toc[0]?.id ?? "");

  useEffect(() => {
    const headings = toc
      .map((t) => document.getElementById(t.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost heading that's intersecting or above the viewport top.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: [0, 1] },
    );
    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [toc]);

  return (
    <div>
      <div className="mb-2 px-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground/70">
        On this page
      </div>
      <ul className="space-y-1 border-l border-border/60">
        {toc.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              onClick={(e) => {
                e.preventDefault();
                document
                  .getElementById(entry.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
                setActiveId(entry.id);
              }}
              className={cn(
                "block border-l-2 py-0.5 text-[12px] transition",
                entry.level === 3 ? "pl-6" : "pl-3",
                activeId === entry.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {entry.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SearchDialog({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (slug: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [lastQuery, setLastQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset highlight when the query changes (adjust-during-render pattern).
  if (query !== lastQuery) {
    setLastQuery(query);
    setHighlightIdx(0);
  }

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const all = Object.values(DOCS);
    return all
      .map((d) => {
        // simple relevance: title match > category > description > content snippet
        let score = 0;
        if (d.title.toLowerCase().includes(q)) score += 100;
        if (d.category.toLowerCase().includes(q)) score += 30;
        if (d.description.toLowerCase().includes(q)) score += 20;
        // find a content snippet
        const lower = d.content.toLowerCase();
        const pos = lower.indexOf(q);
        if (pos >= 0) {
          score += 10;
          const start = Math.max(0, pos - 40);
          const end = Math.min(d.content.length, pos + q.length + 60);
          return {
            doc: d,
            snippet:
              (start > 0 ? "…" : "") +
              d.content.slice(start, end).replace(/[#`*]/g, "").trim() +
              (end < d.content.length ? "…" : ""),
          };
        }
        return score > 0 ? { doc: d, snippet: d.description } : null;
      })
      .filter((r): r is { doc: typeof DOCS[string]; snippet: string } => r !== null)
      .sort((a, b) => b.doc.title.length - a.doc.title.length)
      .sort((a, b) => (b.doc.title.toLowerCase().includes(q) ? 1 : 0) - (a.doc.title.toLowerCase().includes(q) ? 1 : 0))
      .slice(0, 8);
  }, [query]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[highlightIdx]) onSelect(results[highlightIdx].doc.slug);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[12vh]">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-xl overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border/60 px-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search the docs…"
            className="h-12 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border/60 bg-background/60 px-1.5 py-px font-mono text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2 scrollbar-thin">
          {query.trim() === "" ? (
            <div className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">
              Search across all 18 docs pages. Try “langchain”, “export”, “webhook”.
            </div>
          ) : results.length === 0 ? (
            <div className="px-3 py-8 text-center text-[12.5px] text-muted-foreground">
              No results for “{query}”.
            </div>
          ) : (
            results.map((r, i) => (
              <button
                key={r.doc.slug}
                onMouseEnter={() => setHighlightIdx(i)}
                onClick={() => onSelect(r.doc.slug)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left transition",
                  i === highlightIdx ? "bg-primary/10" : "hover:bg-muted/50",
                )}
              >
                <div className="flex w-full items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">
                    {r.doc.category}
                  </span>
                  <ChevronRight className="h-2.5 w-2.5 text-muted-foreground/40" />
                  <span className="text-[13px] font-medium text-foreground">
                    {r.doc.title}
                  </span>
                </div>
                {r.snippet && (
                  <span className="line-clamp-1 text-[11.5px] text-muted-foreground">
                    {r.snippet}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border/60 px-4 py-2 text-[10.5px] text-muted-foreground">
          <span>
            {results.length > 0
              ? `${results.length} result${results.length > 1 ? "s" : ""}`
              : "Type to search"}
          </span>
          <span className="flex items-center gap-2">
            <kbd className="rounded border border-border/60 bg-background/60 px-1 py-px font-mono">↑↓</kbd>
            navigate
            <kbd className="rounded border border-border/60 bg-background/60 px-1 py-px font-mono">↵</kbd>
            select
          </span>
        </div>
      </div>
    </div>
  );
}
