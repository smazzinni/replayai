// ReplayAI — shared domain types, formatting helpers, diff + test-export logic.
// Pure (no DB, no fetch). Used by both client and server.

export type StepType = "llm_call" | "tool_call" | "retrieval" | "decision" | "error";
export type StepStatus = "success" | "failed" | "running" | "warning";
export type SessionStatus = "success" | "failed" | "running";

export interface SessionStep {
  id: string;
  type: StepType;
  name: string;
  /** ms offset from session start */
  t: number;
  durationMs: number;
  status: StepStatus;
  model?: string | null;
  tokensIn?: number | null;
  tokensOut?: number | null;
  input: string;
  output: string;
}

export interface AgentSession {
  id: string;
  projectId: string;
  name: string;
  agent: string;
  framework: string;
  status: SessionStatus;
  startedAt: string; // ISO
  durationMs: number;
  tokenTotal: number;
  costUsd: number;
  tags: string[];
  steps: SessionStep[];
  /** present in list responses (avoids fetching every step's payload) */
  stepCount?: number;
  /** present when joined with project */
  project?: Project;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  framework: string;
  description: string | null;
  createdAt: string;
  sessionCount?: number;
}

// ---------- formatting ----------

const m = (min: number) => `${String(min).padStart(2, "0")}m`;
const s = (sec: number) => `${String(sec).padStart(2, "0")}s`;

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const minutes = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `${m(minutes)} ${s(rem)}`;
}

export function fmtOffset(ms: number): string {
  const sec = ms / 1000;
  if (sec < 60) return `+${sec.toFixed(1)}s`;
  const minutes = Math.floor(sec / 60);
  const rem = Math.round(sec % 60);
  return `+${m(minutes)}:${s(rem)}`;
}

export function fmtCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(2)}`;
}

export function fmtRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - then;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export const STEP_META: Record<
  StepType,
  { label: string; color: string; dot: string; ring: string }
> = {
  llm_call: {
    label: "LLM",
    color: "text-emerald-400",
    dot: "bg-emerald-400",
    ring: "ring-emerald-400/30",
  },
  tool_call: {
    label: "Tool",
    color: "text-sky-300",
    dot: "bg-sky-300",
    ring: "ring-sky-300/30",
  },
  retrieval: {
    label: "RAG",
    color: "text-violet-300",
    dot: "bg-violet-300",
    ring: "ring-violet-300/30",
  },
  decision: {
    label: "Decision",
    color: "text-amber-300",
    dot: "bg-amber-300",
    ring: "ring-amber-300/30",
  },
  error: {
    label: "Error",
    color: "text-rose-400",
    dot: "bg-rose-400",
    ring: "ring-rose-400/30",
  },
};

export const STATUS_META: Record<
  StepStatus,
  { label: string; className: string }
> = {
  success: {
    label: "Success",
    className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  },
  failed: {
    label: "Failed",
    className: "bg-rose-500/15 text-rose-300 border-rose-500/25",
  },
  running: {
    label: "Running",
    className: "bg-sky-500/15 text-sky-300 border-sky-500/25",
  },
  warning: {
    label: "Warning",
    className: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  },
};

// ---------- diff ----------

export interface DiffRow {
  kind: "same" | "added" | "removed" | "changed";
  left?: SessionStep;
  right?: SessionStep;
  note?: string;
}

/** Align two sessions' steps by index and mark divergences. */
export function diffSessions(a: AgentSession, b: AgentSession): DiffRow[] {
  const rows: DiffRow[] = [];
  const max = Math.max(a.steps.length, b.steps.length);
  for (let i = 0; i < max; i++) {
    const l = a.steps[i];
    const r = b.steps[i];
    if (l && r) {
      const changed =
        l.name !== r.name ||
        l.status !== r.status ||
        l.output.trim() !== r.output.trim();
      rows.push({
        kind: changed ? "changed" : "same",
        left: l,
        right: r,
        note: changed ? "Output / status diverged here" : undefined,
      });
    } else if (l) {
      rows.push({ kind: "removed", left: l });
    } else if (r) {
      rows.push({ kind: "added", right: r });
    }
  }
  return rows;
}

// ---------- export to test ----------

export type ExportLang = "pytest" | "jest";

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export function generateTest(
  session: AgentSession,
  lang: ExportLang,
): string {
  const testName = `test_${slug(session.name)}`;
  if (lang === "pytest") {
    const mocks = session.steps
      .filter((st) => st.type === "tool_call" || st.type === "retrieval")
      .map((st, i) => {
        const fn =
          st.type === "retrieval"
            ? "retrieve"
            : st.name.replace(/\(.*\)$/, "").replace(/\s+/g, "_");
        return (
          `    # step ${i + 1}: ${st.name} → ${st.status}\n` +
          `    replay.mock("${fn}", ${JSON.stringify(st.output)})`
        );
      })
      .join("\n");

    return `# Auto-generated by ReplayAI · session ${session.id}
# Replays the exact recorded conditions of: ${session.name}
# pip install replayai
import pytest
from replayai import ReplaySession

REPLAY_ID = "${session.id}"


def ${testName}(replay: ReplaySession):
    """Replay recorded agent execution with mocked tool/RAG responses.

    Original status: ${session.status}
    Original duration: ${fmtDuration(session.durationMs)}
    Steps recorded: ${session.steps.length}
    """
    # --- Mocked deterministic responses (recorded from production) ---
${mocks || "    # (no mockable tool calls in this session)"}

    # --- Re-run the agent under recorded conditions ---
    with replay.trace() as trace:
        result = replay.run(agent="${session.agent}", framework="${session.framework}")

    # --- Assertions based on the recorded baseline ---
    assert trace.step_count == ${session.steps.length}
    assert trace.status == "${session.status}"
${session.steps
      .filter((st) => st.type === "tool_call")
      .slice(0, 3)
      .map(
        (st, i) =>
          `    assert trace.steps[${i}].output == ${JSON.stringify(st.output.slice(0, 60) + "…")}`,
      )
      .join("\n") || '    assert result is not None'}
`;
  }

  // jest
  const mocks = session.steps
    .filter((st) => st.type === "tool_call" || st.type === "retrieval")
    .map((st) => {
      const fn =
        st.type === "retrieval"
          ? "retrieve"
          : st.name.replace(/\(.*\)$/, "").replace(/\s+/g, "_");
      return `    replay.mock("${fn}", ${JSON.stringify(st.output)});`;
    })
    .join("\n");

  return `// Auto-generated by ReplayAI · session ${session.id}
// Replays the exact recorded conditions of: ${session.name}
// npm install @replayai/sdk
import { ReplaySession } from "@replayai/sdk";

const REPLAY_ID = "${session.id}";

describe("${slug(session.name)}", () => {
  it("replays recorded agent execution deterministically", async () => {
    const replay = new ReplaySession(REPLAY_ID);

    // --- Mocked deterministic responses (recorded from production) ---
${mocks || "    // (no mockable tool calls in this session)"}

    // --- Re-run the agent under recorded conditions ---
    const trace = await replay.run({
      agent: "${session.agent}",
      framework: "${session.framework}",
    });

    // --- Assertions based on the recorded baseline ---
    expect(trace.stepCount).toBe(${session.steps.length});
    expect(trace.status).toBe("${session.status}");
  });
});
`;
}
