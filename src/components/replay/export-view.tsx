"use client";

import { cn } from "@/lib/utils";
import {
  fmtDuration,
  generateTest,
  type AgentSession,
  type ExportLang,
} from "@/lib/replay-data";
import { api } from "@/lib/api";
import { useSession } from "@/hooks/use-api";
import { FileCode2, FlaskConical, Github, Loader2, Terminal } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CodeBlock } from "./code-block";

interface ExportViewProps {
  sessions: AgentSession[];
}

export function ExportView({ sessions }: ExportViewProps) {
  const failed = sessions.find((s) => s.status === "failed");
  const [sessionId, setSessionId] = useState(
    failed?.id ?? sessions[0]?.id ?? "",
  );
  const [lang, setLang] = useState<ExportLang>("pytest");

  const q = useSession(sessionId || null);
  const session = q.data;

  const code = useMemo(
    () => (session ? generateTest(session, lang) : ""),
    [session, lang],
  );

  const mockableCount = session
    ? session.steps.filter((s) => s.type === "tool_call" || s.type === "retrieval")
        .length
    : 0;

  const download = () => {
    if (!session) return;
    window.open(api.exportUrl(session.id, lang, true), "_blank");
    toast.success(`Downloading ${lang} test…`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          <FlaskConical className="h-3.5 w-3.5 text-primary" />
          Export to Test
        </div>
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          Turn a recorded session into a runnable regression test in one click.
          Every tool &amp; RAG call becomes a deterministic mock.
        </p>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[220px]">
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Session
            </span>
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="h-9 w-full rounded-md border border-border/60 bg-background/60 px-2.5 text-[12.5px] outline-none transition focus:border-primary/60"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.status}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span className="mb-1 block text-[10px] uppercase tracking-wider text-muted-foreground">
              Framework
            </span>
            <div className="inline-flex rounded-md border border-border/60 p-0.5">
              {([
                { id: "pytest" as const, label: "pytest", icon: Terminal },
                { id: "jest" as const, label: "jest", icon: FileCode2 },
              ]).map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setLang(opt.id)}
                    className={cn(
                      "inline-flex h-8 items-center gap-1.5 rounded px-3 text-[12px] font-medium transition",
                      lang === opt.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
          <button
            onClick={download}
            disabled={!session}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            <FileCode2 className="h-3.5 w-3.5" />
            Download
          </button>
        </div>

        {session && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Steps recorded" value={String(session.steps.length)} />
            <Stat label="Mocked calls" value={String(mockableCount)} />
            <Stat label="Duration" value={fmtDuration(session.durationMs)} />
            <Stat
              label="Original status"
              value={session.status}
              tone={session.status === "failed" ? "bad" : "good"}
            />
          </div>
        )}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-5">
        <div className="lg:col-span-3 border-b border-border/60 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              {lang === "pytest"
                ? `tests/test_${session?.id}.py`
                : `tests/${session?.id}.test.ts`}
            </span>
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[9.5px] font-medium text-emerald-300">
              auto-generated
            </span>
          </div>
          <div className="scrollbar-thin h-full overflow-auto p-3">
            {q.isLoading ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : (
              <CodeBlock
                code={code}
                language={lang === "pytest" ? "python" : "typescript"}
                numbered
                maxHeight="max-h-[520px]"
                showCopy
              />
            )}
          </div>
        </div>

        <div className="lg:col-span-2 p-4">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            <Github className="h-3.5 w-3.5" /> CI integration
          </div>
          <ol className="space-y-3 text-[12px] leading-relaxed text-muted-foreground">
            <li className="flex gap-2.5">
              <Step n={1} />
              <span>
                Add{" "}
                <code className="rounded bg-muted px-1 py-px font-mono text-[11px] text-foreground/85">
                  replayai record
                </code>{" "}
                to your agent runtime — a 1-line decorator or context manager.
              </span>
            </li>
            <li className="flex gap-2.5">
              <Step n={2} />
              <span>
                When a run fails in prod, hit{" "}
                <span className="font-medium text-foreground/90">
                  Export to Test
                </span>{" "}
                — mocks are extracted from the recording automatically.
              </span>
            </li>
            <li className="flex gap-2.5">
              <Step n={3} />
              <span>
                Commit the generated test. CI now asserts the agent never
                regresses on that exact scenario —{" "}
                <span className="font-medium text-emerald-300">
                  deterministic, $0, no API keys needed
                </span>
                .
              </span>
            </li>
            <li className="flex gap-2.5">
              <Step n={4} />
              <span>
                Toggle{" "}
                <span className="font-medium text-amber-300">Live LLM</span>{" "}
                locally to re-run real model calls against the same inputs and
                catch prompt drift before deploy.
              </span>
            </li>
          </ol>

          <div className="mt-4 rounded-lg border border-dashed border-border/60 bg-muted/20 p-3 text-[11.5px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground/80">
              Why this matters:
            </span>{" "}
            AI agents are non-deterministic, but{" "}
            <span className="text-foreground/90">replays are not</span>. You now
            have the reproducibility of a unit test for a system that was
            previously impossible to test.
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-md border border-border/50 bg-background/40 px-2.5 py-1.5">
      <div className="text-[9.5px] uppercase tracking-wider text-muted-foreground/60">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 font-mono text-[13px] font-semibold capitalize",
          tone === "good" && "text-emerald-300",
          tone === "bad" && "text-rose-300",
          !tone && "text-foreground/90",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 font-mono text-[10px] font-bold text-primary">
      {n}
    </span>
  );
}
