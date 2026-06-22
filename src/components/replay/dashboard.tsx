"use client";

import { cn } from "@/lib/utils";
import { useProjects, useSessions, useSession } from "@/hooks/use-api";
import { motion } from "framer-motion";
import {
  Circle,
  GitCompareArrows,
  History,
  Keyboard,
  Layers,
  Play,
  Search,
  SquareTerminal,
  Wifi,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DiffView } from "./diff-view";
import { ExportView } from "./export-view";
import { RecordSessionDialog } from "./record-session-dialog";
import { RecentSessionsFeed } from "./recent-sessions-feed";
import { ReplayTimeline } from "./replay-timeline";
import { SessionSearch } from "./session-search";
import { SessionsList } from "./sessions-list";
import { StatsOverview } from "./stats-overview";

const TABS = [
  {
    id: "replay",
    label: "Replay",
    icon: Play,
    desc: "Scrub through every step of a recorded run",
  },
  {
    id: "diff",
    label: "Diff",
    icon: GitCompareArrows,
    desc: "Compare two sessions to find where behavior diverged",
  },
  {
    id: "export",
    label: "Export to Test",
    icon: SquareTerminal,
    desc: "Generate a deterministic regression test from any session",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function Dashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<TabId>("replay");
  const [projectId, setProjectId] = useState<string>(""); // "" = all projects
  const [statusFilter, setStatusFilter] = useState<"all" | "failed" | "success">(
    "all",
  );
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const projectsQ = useProjects();
  const sessionsQ = useSessions({
    projectId: projectId || undefined,
    limit: 200,
  });
  const sessions = sessionsQ.data?.sessions ?? [];
  const selectedQ = useSession(selectedId);

  // Auto-select a session when:
  // 1. First load (selectedId is null) — honor ?s=<id> share link or pick first failed
  // 2. Selected session was deleted or filtered out by project switch — pick a replacement
  // (adjust-state-during-render pattern — avoids setState-in-effect.)
  if (sessions.length > 0) {
    const isSelectedValid =
      selectedId !== null && sessions.some((s) => s.id === selectedId);
    if (!isSelectedValid) {
      const shared = searchParams.get("s");
      const initial =
        shared && sessions.some((s) => s.id === shared)
          ? shared
          : (sessions.find((s) => s.status === "failed")?.id ?? sessions[0].id);
      setSelectedId(initial);
    }
  }

  // Keep the URL in sync with the selected session (shareable).
  useEffect(() => {
    if (!selectedId) return;
    if (searchParams.get("s") === selectedId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set("s", selectedId);
    router.replace(`/?${params.toString()}#demo`, { scroll: false });
  }, [selectedId, router, searchParams]);

  const handleRecorded = useCallback((id: string) => {
    setSelectedId(id);
    setTab("replay");
  }, []);

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Diff pair preset from Cmd+K search "compare" action — nonce changes each
  // time so picking the same pair twice still triggers an update.
  const [diffPreset, setDiffPreset] = useState<{
    left: string;
    right: string;
    nonce: number;
  } | null>(null);

  // Keyboard shortcuts: j/k = prev/next session, 1/2/3 = tabs, ? = help.
  // Ignored when the focus is in an input/textarea/select so typing isn't hijacked.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Tab switching (1/2/3 or r/d/e mnemonics)
      if (e.key === "1" || e.key === "r") { setTab("replay"); return; }
      if (e.key === "2" || e.key === "d") { setTab("diff"); return; }
      if (e.key === "3" || e.key === "e") { setTab("export"); return; }

      // Help toggle
      if (e.key === "?") { setShortcutsOpen((v) => !v); return; }
      if (e.key === "Escape") { setShortcutsOpen(false); return; }

      // Session navigation (only in replay tab)
      if (tab !== "replay" || sessions.length === 0) return;
      const idx = sessions.findIndex((s) => s.id === selectedId);
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = sessions[Math.min(idx + 1, sessions.length - 1)];
        if (next) setSelectedId(next.id);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = sessions[Math.max(idx - 1, 0)];
        if (prev) setSelectedId(prev.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, sessions, selectedId]);

  const tabDesc = TABS.find((t) => t.id === tab)?.desc;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/40 backdrop-blur">
      {/* window chrome */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-background/40 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-500/70" />
          <span className="h-3 w-3 rounded-full bg-amber-500/70" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/70" />
        </div>
        <div className="ml-2 hidden items-center gap-2 font-mono text-[11px] text-muted-foreground sm:flex">
          <History className="h-3.5 w-3.5 text-primary" />
          <span className="text-primary">replayai</span>
          <span className="opacity-50">/</span>
          <span>app.replayai.dev</span>
          <span className="opacity-50">/</span>
          <span>sessions</span>
        </div>

        {/* project switcher */}
        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Layers className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="h-7 max-w-[180px] rounded-md border border-border/60 bg-background/60 pl-7 pr-2 text-[11.5px] outline-none transition focus:border-primary/60"
              title="Filter by project"
            >
              <option value="">All projects ({sessions.length})</option>
              {projectsQ.data?.map((p) => {
                const count = sessions.filter(
                  (s) => s.projectId === p.id,
                ).length;
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} ({count})
                  </option>
                );
              })}
            </select>
          </div>

          <span
            className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 sm:inline-flex"
            title="Live updates via WebSocket — new recordings appear instantly"
          >
            <Wifi className="h-3 w-3" />
            live
          </span>

          <button
            onClick={() => setSearchOpen(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-2 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            title="Search sessions (Ctrl+K)"
            aria-label="Search sessions"
          >
            <Search className="h-3.5 w-3.5" />
            <kbd className="hidden font-mono text-[10px] sm:inline">⌘K</kbd>
          </button>

          <button
            onClick={() => setShortcutsOpen((v) => !v)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 text-[11px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
            title="Keyboard shortcuts (?)"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard className="h-3.5 w-3.5" />
            <kbd className="hidden font-mono text-[10px] sm:inline">?</kbd>
          </button>

          <RecordSessionDialog onRecorded={handleRecorded} />
        </div>
      </div>

      {/* tabs */}
      <div className="flex items-center gap-1 border-b border-border/60 bg-background/30 px-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[12.5px] font-medium transition",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground/80",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {active && (
                <motion.span
                  layoutId="tab-underline"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
        <div className="ml-auto hidden px-2 py-2 text-[10.5px] text-muted-foreground md:block">
          {tabDesc}
        </div>
      </div>

      {/* stats strip + recent sessions feed */}
      <div className="space-y-2 border-b border-border/60 bg-background/20 px-3 py-2.5">
        <StatsOverview />
        <RecentSessionsFeed onSelect={setSelectedId} />
      </div>

      {/* panel */}
      <div className="h-[660px] bg-background/20">
        {tab === "replay" && (
          <div className="grid h-full grid-cols-1 md:grid-cols-[280px_1fr]">
            <div className="hidden border-r border-border/60 md:block">
              <SessionsList
                sessions={sessions}
                isLoading={sessionsQ.isLoading}
                selectedId={selectedId}
                onSelect={setSelectedId}
                q={q}
                setQ={setQ}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
              />
            </div>
            <div className="min-h-0">
              {/* Mobile session picker — shown when sidebar is hidden */}
              <div className="border-b border-border/60 p-3 md:hidden">
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="h-9 w-full rounded-md border border-border/60 bg-background/60 px-2.5 text-[12.5px] outline-none transition focus:border-primary/60"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.status === "failed" ? "✗" : "✓"} {s.name} ·{" "}
                      {s.agent}
                    </option>
                  ))}
                </select>
              </div>
              {selectedId && selectedQ.data ? (
                <ReplayTimeline
                  session={selectedQ.data}
                  isLoading={selectedQ.isLoading}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Circle className="rec-dot h-3 w-3 fill-rose-500 text-rose-500" />
                    <span className="text-[12.5px]">
                      {sessionsQ.isLoading
                        ? "Loading sessions…"
                        : selectedQ.isLoading
                          ? "Loading session…"
                          : "Select a session to replay"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        {tab === "diff" && <DiffView sessions={sessions} presetPair={diffPreset} />}
        {tab === "export" && <ExportView sessions={sessions} />}
      </div>

      {/* Session search dialog (Cmd/Ctrl+K) */}
      <SessionSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onSelect={(id) => {
          setSelectedId(id);
          setTab("replay");
        }}
        onCompare={(a, b) => {
          setDiffPreset({ left: a, right: b, nonce: Date.now() });
          setTab("diff");
        }}
      />

      {/* Keyboard shortcuts overlay */}
      {shortcutsOpen && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShortcutsOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-sm rounded-xl border border-border/60 bg-card p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center gap-2">
              <Keyboard className="h-4 w-4 text-primary" />
              <span className="text-[13px] font-semibold">Keyboard shortcuts</span>
              <button
                onClick={() => setShortcutsOpen(false)}
                className="ml-auto text-[11px] text-muted-foreground hover:text-foreground"
              >
                Esc
              </button>
            </div>
            <div className="space-y-2">
              {[
                { keys: ["j", "↓"], label: "Next session" },
                { keys: ["k", "↑"], label: "Previous session" },
                { keys: ["1", "r"], label: "Replay tab" },
                { keys: ["2", "d"], label: "Diff tab" },
                { keys: ["3", "e"], label: "Export tab" },
                { keys: ["⌘K"], label: "Search sessions" },
                { keys: ["?"], label: "Toggle this help" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-[12px] text-muted-foreground">{s.label}</span>
                  <div className="flex gap-1">
                    {s.keys.map((k) => (
                      <kbd
                        key={k}
                        className="rounded border border-border/60 bg-background/60 px-1.5 py-0.5 font-mono text-[10.5px] text-foreground/80"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
