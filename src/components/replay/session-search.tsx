"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useSessions } from "@/hooks/use-api";
import { fmtCost, fmtDuration, type SessionStatus } from "@/lib/replay-data";
import {
  CheckCircle2,
  Clock,
  Coins,
  Link2,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

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
}

/** Cmd+K session search dialog with fuzzy-style filtering via cmdk. */
export function SessionSearch({
  open,
  onOpenChange,
  onSelect,
}: SessionSearchProps) {
  const { data, isLoading } = useSessions({ limit: 200 });
  const allSessions = data?.sessions ?? [];
  const [query, setQuery] = useState("");

  // Client-side filter (cmdk's shouldFilter is disabled so we control it).
  const sessions = query.trim()
    ? allSessions.filter((s) =>
        `${s.name} ${s.agent} ${s.tags.join(" ")} ${s.framework} ${s.id}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
      )
    : allSessions;

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

  // Reset query when the dialog closes (via the open-change handler, not an
  // effect — avoids the setState-in-effect lint).
  const handleOpenChange = (v: boolean) => {
    if (!v) setQuery("");
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="overflow-hidden border-border/60 bg-card p-0 shadow-2xl sm:max-w-[560px]">
        <Command className="rounded-xl" loop shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-border/60 px-3">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search sessions by name, agent, or tag…"
              className="h-11 flex-1 border-0 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground focus:ring-0"
            />
            <kbd className="hidden rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
              Esc
            </kbd>
          </div>
          <CommandList className="max-h-[360px] scrollbar-thin">
            {sessions.length === 0 && (
              <CommandEmpty>
                {isLoading
                  ? "Loading sessions…"
                  : query
                    ? `No sessions match "${query}".`
                    : "No sessions yet."}
              </CommandEmpty>
            )}
            {sessions.length > 0 && (
              <CommandGroup
                heading={
                  query
                    ? `${sessions.length} match${sessions.length === 1 ? "" : "es"}`
                    : `${sessions.length} sessions`
                }
                className="text-[11px] text-muted-foreground"
              >
                {sessions.map((s) => {
                  const meta = STATUS_ICON[s.status];
                  const Icon = meta.icon;
                  const stepN = s.stepCount ?? s.steps.length;
                  return (
                    <CommandItem
                      key={s.id}
                      value={s.id}
                      onSelect={() => {
                        onSelect(s.id);
                        onOpenChange(false);
                      }}
                      className="gap-2.5 px-3 py-2 text-[12.5px] aria-selected:bg-primary/10"
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${meta.className}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-foreground/90">
                          {s.name}
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
                          className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 transition hover:bg-muted hover:text-primary"
                          title="Copy shareable link"
                          aria-label="Copy session link"
                        >
                          <Link2 className="h-3 w-3" />
                        </button>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
          <div className="border-t border-border/60 px-3 py-1.5 text-[10.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Search className="h-3 w-3" />
              Search by name, agent, tag, or framework
            </span>
            <span className="ml-2 hidden sm:inline">
              · <kbd className="font-mono">↑↓</kbd> navigate{" "}
              <kbd className="font-mono">↵</kbd> select
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
