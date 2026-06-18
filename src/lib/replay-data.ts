// ReplayAI — session recording domain model + mock data + export helpers

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
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  input: string;
  output: string;
  /** structured payload shown in JSON viewer */
  payload?: Record<string, unknown>;
}

export interface AgentSession {
  id: string;
  name: string;
  agent: string;
  framework: "LangChain" | "LlamaIndex" | "CrewAI" | "Custom";
  status: SessionStatus;
  startedAt: string;
  durationMs: number;
  tokenTotal: number;
  costUsd: number;
  tags: string[];
  steps: SessionStep[];
}

const m = (min: number) => `${String(min).padStart(2, "0")}m`;
const s = (sec: number) => `${String(sec).padStart(2, "0")}s`;

export const SESSIONS: AgentSession[] = [
  {
    id: "ses_8fa1",
    name: "Customer Support — Refund Query #4821",
    agent: "support-agent-v3",
    framework: "LangChain",
    status: "failed",
    startedAt: "2025-01-14T09:42:11Z",
    durationMs: 18420,
    tokenTotal: 7420,
    costUsd: 0.094,
    tags: ["production", "refund-flow", "regression"],
    steps: [
      {
        id: "st_1",
        type: "llm_call",
        name: "Classify intent",
        t: 0,
        durationMs: 820,
        status: "success",
        model: "gpt-4o-mini",
        tokensIn: 312,
        tokensOut: 24,
        input:
          "User: 'I was charged twice for my January subscription. I want a full refund immediately.'",
        output: "intent: billing_dispute · confidence: 0.94",
      },
      {
        id: "st_2",
        type: "tool_call",
        name: "lookup_customer(email)",
        t: 840,
        durationMs: 410,
        status: "success",
        input: "email = ada.l@protonmail.com",
        output:
          '{ "customer_id": "cus_8821", "plan": "Pro Annual", "mrr": 24.0, "tenure_months": 14 }',
      },
      {
        id: "st_3",
        type: "tool_call",
        name: "get_charges(customer_id)",
        t: 1290,
        durationMs: 680,
        status: "success",
        input: "customer_id = cus_8821",
        output:
          '{ "charges": [ { "id": "ch_001", "amount": 2400, "date": "2025-01-02" }, { "id": "ch_002", "amount": 2400, "date": "2025-01-02" } ] }',
      },
      {
        id: "st_4",
        type: "retrieval",
        name: "RAG: refund policy",
        t: 2010,
        durationMs: 540,
        status: "warning",
        input: "query = 'duplicate charge refund policy'",
        output:
          "Top-3 chunks (cosine 0.71): …policy allows refunds for duplicate charges within 30 days ONLY for monthly plans. Annual plans require manager approval (see Sec 4.2)…",
      },
      {
        id: "st_5",
        type: "llm_call",
        name: "Draft response",
        t: 2580,
        durationMs: 2340,
        status: "failed",
        model: "gpt-4o",
        tokensIn: 1840,
        tokensOut: 410,
        input:
          "System: You are a support agent. Refund duplicate charges fully. Be concise.\n\nContext: customer on Pro Annual, duplicate charge confirmed.\nRetrieved policy: …30 days… monthly plans… annual requires manager approval…",
        output:
          "Hi Ada! I've confirmed the duplicate charge and processed a full refund of $24.00 to your original payment method. You should see it in 3–5 business days. Sorry for the inconvenience! 💚",
      },
      {
        id: "st_6",
        type: "tool_call",
        name: "issue_refund(charge_id, amount)",
        t: 4960,
        durationMs: 1180,
        status: "failed",
        input: "charge_id = ch_002, amount = 2400 (full)",
        output:
          "ERROR 403: refund_blocked — annual plan requires manager_approval token. Missing field: `approval_id`.",
      },
      {
        id: "st_7",
        type: "llm_call",
        name: "Retry with approval (hallucinated)",
        t: 6200,
        durationMs: 1820,
        status: "failed",
        model: "gpt-4o",
        tokensIn: 2110,
        tokensOut: 380,
        input: "Tool error: refund_blocked, requires approval_id. Retry the call.",
        output:
          "I'll retry with an approval token. [calling issue_refund(charge_id=ch_002, amount=2400, approval_id='mgr_auto_2024')]",
      },
      {
        id: "st_8",
        type: "tool_call",
        name: "issue_refund(retry)",
        t: 8060,
        durationMs: 940,
        status: "failed",
        input: "charge_id=ch_002, amount=2400, approval_id='mgr_auto_2024' (HALLUCINATED)",
        output:
          "ERROR 401: invalid_approval_token — 'mgr_auto_2024' does not exist. 3 consecutive failures → escalation triggered.",
      },
    ],
  },
  {
    id: "ses_2c7e",
    name: "Customer Support — Refund Query #4821 (canary)",
    agent: "support-agent-v3.1",
    framework: "LangChain",
    status: "success",
    startedAt: "2025-01-14T11:08:02Z",
    durationMs: 14210,
    tokenTotal: 6210,
    costUsd: 0.071,
    tags: ["canary", "refund-flow", "v3.1"],
    steps: [
      {
        id: "st_1",
        type: "llm_call",
        name: "Classify intent",
        t: 0,
        durationMs: 780,
        status: "success",
        model: "gpt-4o-mini",
        tokensIn: 312,
        tokensOut: 24,
        input:
          "User: 'I was charged twice for my January subscription. I want a full refund immediately.'",
        output: "intent: billing_dispute · confidence: 0.94",
      },
      {
        id: "st_2",
        type: "tool_call",
        name: "lookup_customer(email)",
        t: 800,
        durationMs: 390,
        status: "success",
        input: "email = ada.l@protonmail.com",
        output:
          '{ "customer_id": "cus_8821", "plan": "Pro Annual", "mrr": 24.0, "tenure_months": 14 }',
      },
      {
        id: "st_3",
        type: "tool_call",
        name: "get_charges(customer_id)",
        t: 1210,
        durationMs: 660,
        status: "success",
        input: "customer_id = cus_8821",
        output:
          '{ "charges": [ { "id": "ch_001", "amount": 2400, "date": "2025-01-02" }, { "id": "ch_002", "amount": 2400, "date": "2025-01-02" } ] }',
      },
      {
        id: "st_4",
        type: "retrieval",
        name: "RAG: refund policy",
        t: 1900,
        durationMs: 510,
        status: "success",
        input: "query = 'duplicate charge refund policy annual plan'",
        output:
          "Top-3 chunks (cosine 0.88): …duplicate charges are refunded in full regardless of plan. Annual plans: agent must request manager approval via request_manager_approval() before calling issue_refund()…",
      },
      {
        id: "st_5",
        type: "decision",
        name: "Plan: annual → require approval",
        t: 2430,
        durationMs: 30,
        status: "success",
        input: "plan == 'Pro Annual' & duplicate confirmed",
        output: "route → request_manager_approval() before refund",
      },
      {
        id: "st_6",
        type: "tool_call",
        name: "request_manager_approval()",
        t: 2480,
        durationMs: 4200,
        status: "success",
        input: "customer=cus_8821, reason=duplicate_charge, amount=2400",
        output: '{ "approval_id": "apr_77f1", "expires_in": 900 }',
      },
      {
        id: "st_7",
        type: "llm_call",
        name: "Draft response",
        t: 6700,
        durationMs: 2100,
        status: "success",
        model: "gpt-4o",
        tokensIn: 1720,
        tokensOut: 360,
        input:
          "System: …Refund duplicate charges. Annual plans need approval (already obtained: apr_77f1)…",
        output:
          "Hi Ada! I've confirmed the duplicate charge. Since you're on the Annual plan, I've requested manager approval and processed a full refund of $24.00. You'll see it in 3–5 business days. 💚",
      },
      {
        id: "st_8",
        type: "tool_call",
        name: "issue_refund(approval_id)",
        t: 8820,
        durationMs: 1040,
        status: "success",
        input: "charge_id=ch_002, amount=2400, approval_id=apr_77f1",
        output: '{ "refund_id": "ref_3391", "status": "succeeded", "amount": 2400 }',
      },
    ],
  },
  {
    id: "ses_9bd0",
    name: "Research Agent — Competitor Pricing Analysis",
    agent: "research-agent-v2",
    framework: "CrewAI",
    status: "success",
    startedAt: "2025-01-14T08:15:33Z",
    durationMs: 41280,
    tokenTotal: 14820,
    costUsd: 0.211,
    tags: ["research", "batch"],
    steps: [
      {
        id: "st_1",
        type: "llm_call",
        name: "Decompose research question",
        t: 0,
        durationMs: 1420,
        status: "success",
        model: "claude-3.5-sonnet",
        tokensIn: 540,
        tokensOut: 180,
        input: "Compare pricing of 5 observability tools for AI agents.",
        output: "Plan: 1) list targets 2) fetch pricing pages 3) normalize 4) synthesize table",
      },
      {
        id: "st_2",
        type: "tool_call",
        name: "web_search('AI agent observability pricing')",
        t: 1460,
        durationMs: 2100,
        status: "success",
        input: "query = AI agent observability pricing 2025",
        output: "8 results: LangSmith, Langfuse, Helicone, Phoenix, Datadog LLM, Braintrust, Lunary, ReplayAI",
      },
      {
        id: "st_3",
        type: "retrieval",
        name: "Fetch & chunk pricing pages (5)",
        t: 3600,
        durationMs: 9800,
        status: "success",
        input: "urls = [langchain.com/langsmith, langfuse.com, helicone.ai, …]",
        output: "5 pages chunked · 412 chunks · embeddings stored",
      },
      {
        id: "st_4",
        type: "llm_call",
        name: "Extract pricing per vendor",
        t: 13420,
        durationMs: 8200,
        status: "success",
        model: "claude-3.5-sonnet",
        tokensIn: 6200,
        tokensOut: 980,
        input: "For each vendor, extract: free tier, paid tier, enterprise tier, usage limits.",
        output: "5 vendor pricing cards extracted (JSON)",
      },
      {
        id: "st_5",
        type: "llm_call",
        name: "Synthesize comparison table",
        t: 21660,
        durationMs: 6400,
        status: "success",
        model: "claude-3.5-sonnet",
        tokensIn: 4100,
        tokensOut: 1120,
        input: "Normalize into a markdown comparison table with footnotes.",
        output: "| Vendor | Free | Pro | Enterprise | … |",
      },
    ],
  },
  {
    id: "ses_4f2a",
    name: "Sales Outreach — Lead Enrichment Loop",
    agent: "sales-agent-v1",
    framework: "Custom",
    status: "failed",
    startedAt: "2025-01-13T22:03:47Z",
    durationMs: 67240,
    tokenTotal: 28910,
    costUsd: 0.418,
    tags: ["production", "cost-spike", "loop"],
    steps: [
      {
        id: "st_1",
        type: "llm_call",
        name: "Enrich lead profile",
        t: 0,
        durationMs: 1800,
        status: "success",
        model: "gpt-4o",
        tokensIn: 820,
        tokensOut: 240,
        input: "Lead: Jordan Pike, VP Eng at Northwind",
        output: "Need: company size, tech stack, recent funding",
      },
      {
        id: "st_2",
        type: "tool_call",
        name: "enrich_lead(lead_id)",
        t: 1820,
        durationMs: 3200,
        status: "success",
        input: "lead_id = ld_2241",
        output: '{ "size": null, "tech_stack": [], "funding": null }',
      },
      {
        id: "st_3",
        type: "llm_call",
        name: "Decide: data incomplete → retry",
        t: 5040,
        durationMs: 1100,
        status: "warning",
        model: "gpt-4o",
        tokensIn: 940,
        tokensOut: 60,
        input: "enrichment returned nulls",
        output: "retry enrich_lead with alternate source",
      },
      {
        id: "st_4",
        type: "tool_call",
        name: "enrich_lead(retry #1)",
        t: 6160,
        durationMs: 2900,
        status: "warning",
        input: "lead_id = ld_2241, source = clearbit",
        output: '{ "size": null, "tech_stack": [], "funding": null }',
      },
      {
        id: "st_5",
        type: "tool_call",
        name: "enrich_lead(retry #2)",
        t: 9080,
        durationMs: 2740,
        status: "warning",
        input: "lead_id = ld_2241, source = zoominfo",
        output: '{ "size": null, "tech_stack": [], "funding": null }',
      },
      {
        id: "st_6",
        type: "error",
        name: "Loop guard NOT triggered (max_retries=∞)",
        t: 11840,
        durationMs: 0,
        status: "failed",
        input: "consecutive retries = 12 (expected cap: 3)",
        output:
          "Agent retried enrich_lead 12× over 67s, spending $0.41 on a single lead. No circuit breaker present.",
      },
    ],
  },
  {
    id: "ses_1e8c",
    name: "RAG Q&A — Internal Docs 'PTO Policy'",
    agent: "docs-qa-agent",
    framework: "LlamaIndex",
    status: "success",
    startedAt: "2025-01-14T10:22:09Z",
    durationMs: 3120,
    tokenTotal: 1840,
    costUsd: 0.012,
    tags: ["internal", "rag"],
    steps: [
      {
        id: "st_1",
        type: "retrieval",
        name: "Embed query & search",
        t: 0,
        durationMs: 180,
        status: "success",
        input: "query = 'How many PTO days carry over?'",
        output: "Top-4 chunks (cosine 0.82–0.91) from /hr/handbook",
      },
      {
        id: "st_2",
        type: "llm_call",
        name: "Answer with citations",
        t: 200,
        durationMs: 2920,
        status: "success",
        model: "gpt-4o-mini",
        tokensIn: 1240,
        tokensOut: 220,
        input: "Context: 4 chunks about PTO carryover…",
        output: "Up to 5 days carry over, must be used by March 31 [HR-HBK-§7.3].",
      },
    ],
  },
];

// ---------- helpers ----------

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
