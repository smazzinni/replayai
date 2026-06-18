"use client";

import { cn } from "@/lib/utils";
import { useProjects, useSessions, useSession } from "@/hooks/use-api";
import { motion } from "framer-motion";
import {
  Circle,
  GitCompareArrows,
  History,
  Layers,
  Play,
  SquareTerminal,
  Wifi,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DiffView } from "./diff-view";
import { ExportView } from "./export-view";
import { RecordSessionDialog } from "./record-session-dialog";
import { ReplayTimeline } from "./replay-timeline";
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

  // On first load, honor a ?s=<id> share link, else default to first failed.
  // (adjust-state-during-render pattern — avoids setState-in-effect.)
  if (selectedId === null && sessions.length > 0) {
    const shared = searchParams.get("s");
    const initial =
      shared && sessions.some((s) => s.id === shared)
        ? shared
        : (sessions.find((s) => s.status === "failed")?.id ?? sessions[0].id);
    setSelectedId(initial);
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

  const tabDesc = TABS.find((t) => t.id === tab)?.desc;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/40 backdrop-blur">
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
              className="h-7 max-w-[160px] rounded-md border border-border/60 bg-background/60 pl-7 pr-2 text-[11.5px] outline-none transition focus:border-primary/60"
              title="Filter by project"
            >
              <option value="">All projects</option>
              {projectsQ.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <span
            className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-300 sm:inline-flex"
            title="Live updates via WebSocket — new recordings appear instantly"
          >
            <Wifi className="h-3 w-3" />
            live
          </span>

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

      {/* stats strip */}
      <div className="border-b border-border/60 bg-background/20 px-3 py-2.5">
        <StatsOverview />
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
        {tab === "diff" && <DiffView sessions={sessions} />}
        {tab === "export" && <ExportView sessions={sessions} />}
      </div>
    </div>
  );
}
