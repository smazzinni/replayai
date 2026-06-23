"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSessions } from "@/hooks/use-api";
import { useStarredSessions } from "@/hooks/use-starred-sessions";
import { fmtCost, fmtDuration, type SessionStatus } from "@/lib/replay-data";
import {
  CheckCircle2,
  Clock,
  Coins,
  GitCompareArrows,
  Link2,
  Loader2,
  Search,
  Star,
  X,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<
  SessionStatus,
  { icon: typeof CheckCircle2; className: string }
> = {
  success: { icon: CheckCircle2, className: "text-emerald-400" },
  failed: { icon: XCircle, className: "text-rose-400" },
  running: { icon: Loader2, className: "text-sky-400 animate-spin" },
};

interface SessionSearchProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (id: string) => void;
  onCompare?: (aId: string, bId: string) => void;
}

/** Cmd+K session search dialog with fuzzy-style filtering via cmdk. */
export function SessionSearch({
  open,
  onOpenChange,
  onSelect,
  onCompare,
}: SessionSearchProps) {
  const { data, isLoading } = useSessions({ limit: 200 });
  const allSessions = data?.sessions ?? [];
  const [query, setQuery] = useState("");
  const [comparePick, setComparePick] = useState<string[]>([]);
  const starred = useStarredSessions();

  // Client-side filter (cmdk's shouldFilter is disabled so we control it).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allSessions;
    return allSessions.filter((s) =>
      `${s.name} ${s.agent} ${s.tags.join(" ")} ${s.framework} ${s.id}`
        .toLowerCase()
        .includes(q),
    );
  }, [allSessions, query]);

  // When the query is empty, surface starred sessions at the top.
  const { starredSessions, otherSessions } = useMemo(() => {
    if (query.trim() || !starred.isReady) {
      return { starredSessions: [], otherSessions: filtered };
    }
    const starredList = filtered.filter((s) => starred.isStarred(s.id));
    const otherList = filtered.filter((s) => !starred.isStarred(s.id));
    return { starredSessions: starredList, otherSessions: otherList };
  }, [filtered, query, starred]);

  // Cmd/Ctrl+K to open, Escape to close (Dialog handles Escape).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Reset query + compare picks when the dialog closes (via the open-change
  // handler, not an effect — avoids the setState-in-effect lint).
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setQuery("");
      setComparePick([]);
    }
    onOpenChange(v);
  };

  const toggleCompare = (id: string) => {
    setComparePick((cur) => {
      // Toggle off if already picked
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      // Build the next pick list — replace the oldest if already 2 picked.
      const next = cur.length >= 2 ? [cur[1], id] : [...cur, id];
      // When 2 are picked, fire onCompare and close — done inline so we
      // don't need a setState-in-effect.
      if (next.length === 2 && onCompare) {
        const [a, b] = next;
        // Defer the close + callback to after the current render commit
        // so the user briefly sees the second pick highlight before close.
        setTimeout(() => {
          onCompare(a, b);
          onOpenChange(false);
          setQuery("");
          setComparePick([]);
        }, 120);
      }
      return next;
    });
  };

  const renderRow = (s: (typeof allSessions)[number]) => {
    const meta = STATUS_ICON[s.status];
    const Icon = meta.icon;
    const stepN = s.stepCount ?? s.steps.length;
    const isPicked = comparePick.includes(s.id);
    const pickIdx = comparePick.indexOf(s.id);
    const isStarred = starred.isReady && starred.isStarred(s.id);
    return (
      <CommandItem
        key={s.id}
        value={s.id}
        onSelect={() => {
          if (comparePick.length > 0) {
            toggleCompare(s.id);
            return;
          }
          onSelect(s.id);
          onOpenChange(false);
        }}
        className="gap-2.5 px-3 py-2 text-[12.5px] aria-selected:bg-primary/10"
      >
        <Icon className={cn("h-4 w-4 shrink-0", meta.className)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate font-medium text-foreground/90">
            {isStarred && (
              <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
            )}
            <span className="truncate">{s.name}</span>
          </div>
          <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
            <span className="font-mono">{s.agent}</span>
            <span className="opacity-40">·</span>
            <span className="font-mono">{s.id}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2.5 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {fmtDuration(s.durationMs)}
          </span>
          <span className="inline-flex items-center gap-0.5">
            <Coins className="h-2.5 w-2.5" />
            {fmtCost(s.costUsd)}
          </span>
          <span>{stepN} steps</span>
          {onCompare && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleCompare(s.id);
                if (comparePick.length === 0) {
                  toast.info("Session A picked — pick another to compare", {
                    description: s.name,
                  });
                }
              }}
              className={cn(
                "ml-1 inline-flex h-5 w-5 items-center justify-center rounded transition",
                isPicked
                  ? "bg-primary/20 text-primary"
                  : "text-muted-foreground/50 hover:bg-muted hover:text-primary",
              )}
              title={
                isPicked
                  ? `Picked as ${pickIdx === 0 ? "A" : "B"} — click to remove`
                  : "Pick for compare"
              }
              aria-label="Pick session for compare"
            >
              {isPicked ? (
                <span className="font-mono text-[9px] font-bold">
                  {pickIdx === 0 ? "A" : "B"}
                </span>
              ) : (
                <GitCompareArrows className="h-3 w-3" />
              )}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              const url = `${window.location.origin}/?s=${s.id}#demo`;
              navigator.clipboard
                .writeText(url)
                .then(() => {
                  toast.success("Link copied", {
                    description: "Shareable session link in your clipboard.",
                  });
                })
                .catch(() => {
                  toast.error("Couldn't copy link");
                });
            }}
            className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 transition hover:bg-muted hover:text-primary"
            title="Copy shareable link"
            aria-label="Copy session link"
          >
            <Link2 className="h-3 w-3" />
          </button>
        </div>
      </CommandItem>
    );
  };

  const totalShown = starredSessions.length + otherSessions.length;
  const heading = query
    ? `${totalShown} match${totalShown === 1 ? "" : "es"}`
    : comparePick.length > 0
      ? `Pick ${comparePick.length === 1 ? "session B" : "— ready"} to compare`
      : `${allSessions.length} sessions`;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden border-border/60 bg-card p-0 shadow-2xl sm:max-w-[560px]">
        <Command className="rounded-xl" loop shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-border/60 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={
                comparePick.length > 0
                  ? "Pick another session to compare…"
                  : "Search sessions by name, agent, or tag…"
              }
              className="h-11 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground focus:ring-0"
            />
            <kbd className="hidden rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
              Esc
            </kbd>
          </div>
          <CommandList className="max-h-[360px] scrollbar-thin">
            {totalShown === 0 && (
              <CommandEmpty>
                {isLoading
                  ? "Loading sessions…"
                  : query
                    ? `No sessions match "${query}".`
                    : "No sessions yet."}
              </CommandEmpty>
            )}
            {starredSessions.length > 0 && (
              <>
                <CommandGroup
                  heading="Starred"
                  className="text-[11px] text-muted-foreground"
                >
                  {starredSessions.map(renderRow)}
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            {otherSessions.length > 0 && (
              <CommandGroup
                heading={heading}
                className="text-[11px] text-muted-foreground"
              >
                {otherSessions.map(renderRow)}
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center gap-2 border-t border-border/60 px-3 py-1.5 text-[10.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Search className="h-3 w-3" />
              Search by name, agent, tag, or framework
            </span>
            <span className="ml-auto hidden sm:inline">
              <kbd className="font-mono">↑↓</kbd> navigate{" "}
              <kbd className="font-mono">↵</kbd> select
              {onCompare && (
                <>
                  {" "}
                  · <GitCompareArrows className="inline h-2.5 w-2.5" /> pick 2 to
                  compare
                </>
              )}
            </span>
          </div>
          {/* Compare selection footer */}
          {onCompare && comparePick.length > 0 && (
            <div className="flex items-center gap-2 border-t border-amber-500/30 bg-amber-500/[0.06] px-3 py-1.5 text-[10.5px] text-amber-300">
              <GitCompareArrows className="h-3 w-3 shrink-0" />
              <span className="font-medium">
                Compare: {comparePick.length}/2 picked
              </span>
              <div className="ml-auto flex items-center gap-1">
                {comparePick.map((id, i) => {
                  const s = allSessions.find((x) => x.id === id);
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[10px]"
                    >
                      <span className="font-bold">
                        {i === 0 ? "A" : "B"}
                      </span>
                      {s?.name ?? id}
                      <button
                        onClick={() => toggleCompare(id)}
                        className="hover:text-amber-100"
                        aria-label={`Remove ${id} from compare`}
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  );
                })}
                <button
                  onClick={() => setComparePick([])}
                  className="ml-1 text-amber-300/70 hover:text-amber-200"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </Command>
      </DialogContent>
    </Dialog>
  );
}
