// Plain seed data used by prisma/seed.ts to populate the database.
// Kept framework-agnostic (no Prisma types) so it can be imported anywhere.

export interface SeedStep {
  id: string;
  type: string;
  name: string;
  t: number;
  durationMs: number;
  status: string;
  model?: string;
  tokensIn?: number;
  tokensOut?: number;
  input: string;
  output: string;
}

export interface SeedSession {
  id: string;
  name: string;
  agent: string;
  framework: string;
  status: string;
  startedAt: string;
  durationMs: number;
  tokenTotal: number;
  costUsd: number;
  tags: string[];
  steps: SeedStep[];
}

export const SEED_PROJECTS = [
  {
    name: "Support Agent",
    slug: "support-agent",
    framework: "LangChain",
    description:
      "Customer support agent handling billing, refunds, and account queries.",
  },
  {
    name: "Research Agent",
    slug: "research-agent",
    framework: "CrewAI",
    description: "Multi-step research agent for competitor analysis and reports.",
  },
  {
    name: "Sales Agent",
    slug: "sales-agent",
    framework: "Custom",
    description: "Lead enrichment and outreach agent.",
  },
  {
    name: "Docs Q&A",
    slug: "docs-qa",
    framework: "LlamaIndex",
    description: "Internal documentation RAG Q&A agent.",
  },
];

export const SEED_SESSIONS: SeedSession[] = [
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

// Map each seed session to a project slug for seeding.
export const SESSION_PROJECT: Record<string, string> = {
  ses_8fa1: "support-agent",
  ses_2c7e: "support-agent",
  ses_9bd0: "research-agent",
  ses_4f2a: "sales-agent",
  ses_1e8c: "docs-qa",
};

/**
 * Rewrite each seed session's `startedAt` to a recent timestamp spread across
 * the last 14 days so the dashboard's 14-day sparkline + charts show activity
 * immediately (instead of all sessions clumped on a single date months ago).
 *
 * The spread is deterministic: session[i] lands `i * 2.6 days` ago with a
 * small hour offset, so the relative ordering is preserved and re-seeding
 * always produces the same shape.
 */
export function withRecentTimestamps(): SeedSession[] {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  return SEED_SESSIONS.map((s, i) => {
    // Spread across 13 days, newest first (index 0 = most recent).
    const daysAgo = Math.round(i * 2.6);
    const hourOffset = (i * 7) % 12; // 0–11h offset for variety
    const startedAt = new Date(
      now - daysAgo * DAY - hourOffset * 60 * 60 * 1000,
    ).toISOString();
    return { ...s, startedAt };
  });
}
