"use client";

import { cn } from "@/lib/utils";
import { SESSIONS, type AgentSession } from "@/lib/replay-data";
import { motion } from "framer-motion";
import { GitCompareArrows, Play, SquareTerminal } from "lucide-react";
import { useState } from "react";
import { DiffView } from "./diff-view";
import { ExportView } from "./export-view";
import { ReplayTimeline } from "./replay-timeline";
import { SessionsList } from "./sessions-list";

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
  const [tab, setTab] = useState<TabId>("replay");
  const [selectedId, setSelectedId] = useState(
    SESSIONS.find((s) => s.status === "failed")?.id ?? SESSIONS[0].id,
  );
  const selected = SESSIONS.find((s) => s.id === selectedId) as AgentSession;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/40 backdrop-blur">
      {/* window chrome */}
      <div className="flex items-center gap-2 border-b border-border/60 bg-background/40 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-rose-500/70" />
          <span className="h-3 w-3 rounded-full bg-amber-500/70" />
          <span className="h-3 w-3 rounded-full bg-emerald-500/70" />
        </div>
        <div className="ml-3 flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span className="text-primary">replayai</span>
          <span className="opacity-50">/</span>
          <span>app.replayai.dev</span>
          <span className="opacity-50">/</span>
          <span>sessions</span>
        </div>
        <div className="ml-auto hidden items-center gap-1.5 text-[10.5px] text-muted-foreground sm:flex">
          <span className="rec-dot h-1.5 w-1.5 rounded-full bg-rose-500" />
          <span className="font-mono">recording</span>
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
          {TABS.find((t) => t.id === tab)?.desc}
        </div>
      </div>

      {/* panel */}
      <div className="h-[640px] bg-background/20">
        {tab === "replay" && (
          <div className="grid h-full grid-cols-1 md:grid-cols-[280px_1fr]">
            <div className="hidden border-r border-border/60 md:block">
              <SessionsList
                sessions={SESSIONS}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            </div>
            <div className="min-h-0">
              <ReplayTimeline session={selected} />
            </div>
          </div>
        )}
        {tab === "diff" && <DiffView sessions={SESSIONS} />}
        {tab === "export" && <ExportView sessions={SESSIONS} />}
      </div>
    </div>
  );
}
