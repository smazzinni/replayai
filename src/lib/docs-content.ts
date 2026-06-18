// ReplayAI developer documentation.
// Each page is authored as markdown and rendered by the DocsApp.
// Content matches the actual SDK surface area and REST API implemented in this app.

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  category: string;
  content: string;
}

export interface DocNavCategory {
  category: string;
  pages: { slug: string; title: string; badge?: string }[];
}

export const DOC_NAV: DocNavCategory[] = [
  {
    category: "Getting Started",
    pages: [
      { slug: "introduction", title: "Introduction" },
      { slug: "installation", title: "Installation" },
      { slug: "quickstart", title: "Quick Start" },
      { slug: "concepts", title: "Core Concepts" },
    ],
  },
  {
    category: "SDK Reference",
    pages: [
      { slug: "sdk-python", title: "Python SDK" },
      { slug: "sdk-typescript", title: "TypeScript SDK" },
      { slug: "sdk-config", title: "Configuration" },
    ],
  },
  {
    category: "Guides",
    pages: [
      { slug: "langchain", title: "LangChain", badge: "Popular" },
      { slug: "crewai", title: "CrewAI", badge: "Popular" },
      { slug: "llamaindex", title: "LlamaIndex" },
      { slug: "custom-agents", title: "Custom Agents" },
      { slug: "ci-cd", title: "CI/CD Integration" },
    ],
  },
  {
    category: "API Reference",
    pages: [
      { slug: "api-overview", title: "Overview & Auth" },
      { slug: "api-projects", title: "Projects" },
      { slug: "api-sessions", title: "Sessions" },
      { slug: "api-export", title: "Export" },
      { slug: "api-stats", title: "Stats" },
      { slug: "api-webhooks", title: "Webhooks" },
    ],
  },
];

const introduction = `# Introduction

ReplayAI is a DVR for AI agent workflows. It records every agent execution — every LLM call, tool call, retrieval, and decision — as a fully replayable session you can scrub, diff, and export as a deterministic regression test.

## Why it exists

AI agents are non-deterministic. The failure you saw in production at 3am almost never reproduces when you re-run the same prompt locally. Existing logging gives you text dumps, but you can't *re-run* the exact conditions that broke.

ReplayAI fixes this by capturing the full execution trace and letting you replay it with every external call mocked from the recording — identical bytes, every time, at zero cost.

## What you get

- **Session recording** — a single decorator wraps your agent and captures inputs, outputs, timing, tokens, and costs.
- **Deterministic replay** — re-run any recorded session with tool and RAG responses served from the recording. Free and 100% reproducible.
- **Visual timeline** — scrub through every step like a video. See call ordering, durations, and failures at a glance.
- **Diff view** — compare two sessions side-by-side to find exactly where behavior diverged.
- **Export to test** — one click turns a failing session into a pytest or jest regression test with mocks auto-extracted.

## How it works

\`\`\`text
┌──────────────┐     record      ┌──────────────┐     store     ┌────────────┐
│  Your agent  │ ──────────────▶ │  replayai    │ ────────────▶ │  Session   │
│  (LangChain, │   trace()       │  tracer      │   JSON        │  store     │
│   CrewAI…)   │                 └──────────────┘               └────────────┘
└──────────────┘                                                        │
                                                                        │ replay
                                                                        ▼
                                                              ┌──────────────────┐
                                                              │  Dashboard / CLI  │
                                                              │  · timeline       │
                                                              │  · diff           │
                                                              │  · export → test  │
                                                              └──────────────────┘
\`\`\`

The tracer is a thin instrumentation layer — no inference, no model calls of its own. It just observes and records. During replay, it serves recorded responses for every external call (tools, retrieval, and optionally LLMs) so the agent re-executes deterministically.

## Where to go next

- New here? Start with the [Quick Start](?view=developers&doc=quickstart) — you'll record and replay a session in under 5 minutes.
- Integrating an existing agent? Jump to the [LangChain](?view=developers&doc=langchain) or [CrewAI](?view=developers&doc=crewai) guide.
- Building a custom integration? Read the [Core Concepts](?view=developers&doc=concepts) then the [API reference](?view=developers&doc=api-overview).
`;

const installation = `# Installation

ReplayAI ships a Python SDK, a TypeScript SDK, and a dashboard. Install the SDK in your agent runtime and run the dashboard locally or in the cloud.

## Python

\`\`\`bash
pip install replayai
\`\`\`

Verify:

\`\`\`bash
python -c "import replayai; print(replayai.__version__)"
# 0.4.1
\`\`\`

## TypeScript / Node.js

\`\`\`bash
npm install @replayai/sdk
# or
bun add @replayai/sdk
\`\`\`

Verify:

\`\`\`bash
node -e "console.log(require('@replayai/sdk').VERSION)"
# 0.4.1
\`\`\`

## Dashboard

The dashboard is a standalone binary that reads your session store and gives you the timeline, diff, and export UI.

\`\`\`bash
# Local mode — reads sessions from disk, no account needed
replayai ui --storage ./replays

# Cloud mode — syncs to app.replayai.dev for team sharing
replayai ui --cloud --token $REPLAYAI_TOKEN
\`\`\`

Open \`http://localhost:7373\` and you'll see the dashboard. On first run it's empty — record a session to populate it.

## Requirements

| Runtime | Minimum | Notes |
| --- | --- | --- |
| Python | 3.9+ | Tested on 3.9, 3.10, 3.11, 3.12 |
| Node.js | 18+ | ESM and CJS both supported |
| Dashboard | macOS, Linux, Windows | Single static binary, ~12 MB |

The SDK has no hard dependency on any agent framework — LangChain, LlamaIndex, CrewAI, AutoGen, and raw OpenAI/Anthropic SDKs all work without special adapters. Framework-specific ergonomics live in optional extras.

## Optional extras

\`\`\`bash
# Python — framework convenience wrappers
pip install "replayai[langchain]"
pip install "replayai[llama_index]"
pip install "replayai[crewai]"
\`\`\`

These extras are tiny (a few dozen lines each). They just pre-wire the tracer into the framework's callback hooks so you don't have to.
`;

const quickstart = `# Quick Start

Record your first agent run and replay it in under 5 minutes.

## 1. Install

\`\`\`bash
pip install replayai
\`\`\`

## 2. Wrap your agent

Add a single decorator (or context manager) around the code that runs your agent:

\`\`\`python
from replayai import trace

@trace("support-agent-v3")
def handle_support_ticket(message: str) -> str:
    intent = classify_intent(message)        # LLM call — recorded
    customer = lookup_customer(message)      # tool call — recorded
    charges = get_charges(customer.id)       # tool call — recorded
    policy = retrieve_refund_policy(intent)  # RAG retrieval — recorded
    response = draft_response(intent, customer, charges, policy)  # LLM — recorded
    return response

handle_support_ticket("I was charged twice, refund me.")
\`\`\`

When the function returns, the session is flushed to your local store:

\`\`\`text
>>> session ses_8fa1 recorded (8 steps, 18.4s)
>>> open  http://localhost:7373/s/ses_8fa1
\`\`\`

## 3. Open the dashboard

\`\`\`bash
replayai ui
\`\`\`

Click the session. You'll see a timeline of every step the agent took — color-coded by type (LLM, Tool, RAG, Decision, Error), with proportional widths showing relative duration.

## 4. Replay it

Hit **Play**. The session re-executes step by step. Every tool and RAG call is **mocked from the recording** — no network, no API keys, zero cost. The LLM responses are replayed verbatim by default.

Toggle **Live LLM** if you want to re-invoke the actual model (useful for testing prompt changes — output may differ and costs apply).

## 5. Export it as a test

Switch to the **Export to Test** tab, pick \`pytest\`, and you get a runnable regression test:

\`\`\`python
# Auto-generated by ReplayAI · session ses_8fa1
import pytest
from replayai import ReplaySession

REPLAY_ID = "ses_8fa1"

def test_support_agent_refund_query(replay: ReplaySession):
    # Mocked deterministic responses (recorded from production)
    replay.mock("lookup_customer", '{"customer_id":"cus_8821",...}')
    replay.mock("get_charges", '{"charges":[...]}')
    replay.mock("retrieve", 'Top-3 chunks (cosine 0.71): …')

    with replay.trace() as trace:
        result = replay.run(agent="support-agent-v3", framework="LangChain")

    assert trace.step_count == 8
    assert trace.status == "failed"
\`\`\`

Commit it. CI now asserts the agent never regresses on that exact scenario — **deterministic, free, no API keys needed**.

## That's it

You now have:
- A recorded session you can replay any time.
- A failing-run test that will catch regressions forever.
- A diff tool to compare this run against future ones.

Next, read the [Core Concepts](?view=developers&doc=concepts) to understand what's actually being recorded, or jump to the [LangChain guide](?view=developers&doc=langchain) for framework-specific patterns.
`;

const concepts = `# Core Concepts

ReplayAI has four primitives: **projects**, **sessions**, **steps**, and **replay**. Understanding these four is all you need.

## Projects

A project is a logical grouping of sessions — typically one per agent deployment. Projects let you scope the dashboard, filter sessions, and manage access in the cloud product.

\`\`\`python
# Pin a run to a specific project
@trace("support-agent-v3", project="support-agent")
def handle_support_ticket(message): ...
\`\`\`

If you omit \`project\`, the SDK uses the \`REPLAYAI_PROJECT\` env var, then falls back to the first project in your store.

## Sessions

A session is a single recorded execution of an agent — one user message in, one final response out (or a failure). A session contains:

| Field | Description |
| --- | --- |
| \`id\` | Stable identifier (\`ses_xxxx\`), used in share links and tests |
| \`status\` | \`success\`, \`failed\`, or \`running\` |
| \`startedAt\` | When the run began |
| \`durationMs\` | Wall-clock duration |
| \`tokenTotal\` | Sum of input + output tokens across all LLM calls |
| \`costUsd\` | Estimated cost, derived from per-model rates |
| \`tags\` | Free-form labels for filtering (\`production\`, \`canary\`, …) |
| \`steps\` | Ordered list of steps (see below) |

A session is **immutable once it's flushed**. To "edit" one, you delete and re-record — which is exactly what you want for a debugging artifact. Immutability is what makes replays trustworthy.

## Steps

A step is a single observable action the agent took. There are five types:

| Type | Color | What it represents | Replay behavior |
| --- | --- | --- | --- |
| \`llm_call\` | emerald | A call to a language model | Replayed verbatim by default; opt-in to re-invoke live |
| \`tool_call\` | sky | A function/tool the agent invoked (e.g. \`issue_refund\`) | Always mocked from recording |
| \`retrieval\` | violet | A RAG retrieval (vector search, keyword, hybrid) | Always mocked from recording |
| \`decision\` | amber | A routing/branching decision the agent made | Replayed verbatim |
| \`error\` | rose | A failure (tool error, exception, guardrail trip) | Reproduced deterministically |

Each step records its name, offset from session start, duration, status, model (for LLM calls), token counts, input, and output. That's it — no internal state, no black box.

The key insight: **only \`llm_call\` steps are non-deterministic in the original run**. Everything else (tools, retrieval, decisions) is deterministic given the same inputs. So during replay, we mock the deterministic external calls and serve the recorded LLM responses — giving you a fully reproducible execution.

## Replay

Replay re-runs a recorded session under the exact conditions that produced it. There are two modes:

### Mocked LLM (default, free, deterministic)

Every step — tools, retrieval, *and* LLM responses — is served from the recording. The agent re-executes but every external call short-circuits to the recorded bytes. Output is byte-identical to the original. Costs nothing. Use this for:

- Debugging a specific failure
- Regression tests in CI
- Sharing a reproduction with a teammate

### Live LLM (opt-in, paid, non-deterministic)

Tools and retrieval are still mocked, but LLM calls are re-invoked against the real model with the recorded input. Useful for:

- Testing whether a prompt change produces different output
- Catching model drift before deploy
- A/B comparing two model versions on identical inputs

You toggle this per-run in the dashboard, or with the \`--live-llm\` flag in the CLI.

## What gets recorded (and what doesn't)

**Recorded:** every LLM call's full prompt + completion, every tool call's args + result, every retrieval's query + returned chunks, all timing, all token counts, all errors.

**Not recorded:** secrets in environment variables (the SDK redacts known secret patterns), file contents not passed through the agent, network traffic not mediated by the agent.

> **Note:** The SDK redacts values matching common secret patterns (\`sk-\`, \`Bearer \`, \`password=\`, etc.) before writing to the store. You can add custom redaction patterns via [\`REPLAYAI_REDACT_PATTERNS\`](?view=developers&doc=sdk-config).
`;

const sdkPython = `# Python SDK

The Python SDK is the primary way to instrument agents. It's framework-agnostic at its core — the framework extras just pre-wire callbacks.

## \`trace()\` — the only function you need

\`trace()\` is both a decorator and a context manager. It starts a session, records every step inside it, and flushes on exit.

\`\`\`python
from replayai import trace

# As a decorator
@trace("support-agent-v3", project="support-agent", tags=["production"])
def handle_support_ticket(message: str) -> str:
    ...

# As a context manager
with trace("research-agent-v2", tags=["batch"]):
    result = crew.kickoff(inputs={"topic": "AI observability pricing"})
\`\`\`

### Signature

\`\`\`python
def trace(
    name: str,
    *,
    project: str | None = None,       # project slug or id; defaults to env
    tags: list[str] | None = None,     # free-form labels
    framework: str = "Custom",         # metadata only
    started_at: datetime | None = None,# defaults to now()
) -> TraceContext
\`\`\`

The returned \`TraceContext\` is also a context manager — exiting it flushes the session to the store and broadcasts a \`session:created\` event to any connected dashboards.

## Manual step recording

Normally you don't record steps manually — the framework integrations do it for you. But for custom agents or when you want explicit control:

\`\`\`python
from replayai import trace, record_step

with trace("custom-agent") as ctx:
    # Record an LLM call manually
    record_step(
        type="llm_call",
        name="classify_intent",
        model="gpt-4o-mini",
        tokens_in=312,
        tokens_out=24,
        input="User: refund please",
        output="intent: billing_dispute",
        status="success",
    )

    # Record a tool call
    record_step(
        type="tool_call",
        name="issue_refund",
        input='{"charge_id": "ch_002"}',
        output='{"refund_id": "ref_3391"}',
        status="success",
    )

    # Record an error
    record_step(
        type="error",
        name="refund_blocked",
        input="charge_id=ch_002",
        output="ERROR 403: requires approval_id",
        status="failed",
    )
\`\`\`

Steps are timestamped automatically relative to session start. The \`t\` (offset) and \`durationMs\` fields are inferred unless you pass them explicitly.

## \`ReplaySession\` — for tests and CLI replay

\`ReplaySession\` loads a recorded session and re-runs it under mocked (or live) conditions. This is what the exported tests use.

\`\`\`python
from replayai import ReplaySession

replay = ReplaySession("ses_8fa1")

# Register mocks explicitly (optional — the recording is used by default)
replay.mock("issue_refund", '{"refund_id":"ref_3391","status":"succeeded"}')

# Run the agent under recorded conditions
with replay.trace() as trace:
    result = replay.run(agent="support-agent-v3", framework="LangChain")

assert trace.step_count == 8
assert trace.status == "failed"
\`\`\`

### \`ReplaySession\` API

\`\`\`python
class ReplaySession:
    def __init__(self, session_id: str, *, live_llm: bool = False): ...

    def mock(self, fn_name: str, response: str | dict) -> None:
        """Override the recorded response for a tool/retrieval call."""

    def run(self, *, agent: str, framework: str = "Custom") -> Any:
        """Re-execute the agent. Tools/RAG are mocked; LLM is replayed unless live_llm=True."""

    def trace(self) -> TraceContext:
        """Context manager yielding a Trace with .step_count, .status, .steps[]."""

    def export(self, lang: str = "pytest") -> str:
        """Generate a test file as a string. lang='pytest' | 'jest'."""
\`\`\`

## Async support

The SDK is fully async-compatible. Use \`atrace\` and \`arecord_step\`:

\`\`\`python
import asyncio
from replayai import atrace, arecord_step

@atrace("async-agent")
async def handle(message: str) -> str:
    intent = await classify(message)
    await arecord_step(type="llm_call", name="classify", ...)
    return intent

asyncio.run(handle("hello"))
\`\`\`

## Error handling

The tracer never raises into your agent code. If recording fails (disk full, network error to cloud store), it logs a warning and continues — your agent's correctness never depends on ReplayAI.

You can opt into strict mode if you want recording failures to surface:

\`\`\`python
import replayai
replayai.strict_mode = True  # raises RecordingError on failure
\`\`\`
`;

const sdkTypescript = `# TypeScript SDK

The TypeScript SDK mirrors the Python SDK's surface area. It ships as ESM and CJS, works in Node 18+ and Bun, and has first-class async support.

## \`trace()\` — decorator-style and context manager

JavaScript has no decorators-as-syntax in stable runtime yet, so the SDK uses a higher-order function and a context manager:

\`\`\`typescript
import { trace, withTrace } from "@replayai/sdk";

// Higher-order function (wraps an existing function)
export const handleSupportTicket = trace(
  "support-agent-v3",
  { project: "support-agent", tags: ["production"] },
  async (message: string): Promise<string> => {
    const intent = await classifyIntent(message);
    const customer = await lookupCustomer(message);
    // ...
    return response;
  },
);

// Context manager (for non-function scopes)
await withTrace("research-agent-v2", { tags: ["batch"] }, async () => {
  const result = await crew.kickoff({ topic: "AI observability pricing" });
  return result;
});
\`\`\`

### Signature

\`\`\`typescript
function trace<T extends (...args: any[]) => any>(
  name: string,
  opts?: {
    project?: string;
    tags?: string[];
    framework?: string;
    startedAt?: Date;
  },
  fn: T,
): T;

function withTrace<T>(
  name: string,
  opts: TraceOptions,
  fn: () => T | Promise<T>,
): Promise<T>;
\`\`\`

## Manual step recording

\`\`\`typescript
import { trace, recordStep } from "@replayai/sdk";

await withTrace("custom-agent", {}, async () => {
  await recordStep({
    type: "llm_call",
    name: "classify_intent",
    model: "gpt-4o-mini",
    tokensIn: 312,
    tokensOut: 24,
    input: "User: refund please",
    output: "intent: billing_dispute",
    status: "success",
  });

  await recordStep({
    type: "tool_call",
    name: "issue_refund",
    input: JSON.stringify({ charge_id: "ch_002" }),
    output: JSON.stringify({ refund_id: "ref_3391" }),
    status: "success",
  });
});
\`\`\`

## \`ReplaySession\`

\`\`\`typescript
import { ReplaySession } from "@replayai/sdk";

const replay = new ReplaySession("ses_8fa1", { liveLlm: false });

replay.mock("issue_refund", JSON.stringify({ refund_id: "ref_3391" }));

const trace = await replay.run({
  agent: "support-agent-v3",
  framework: "LangChain",
});

expect(trace.stepCount).toBe(8);
expect(trace.status).toBe("failed");
\`\`\`

### \`ReplaySession\` API

\`\`\`typescript
class ReplaySession {
  constructor(sessionId: string, opts?: { liveLlm?: boolean });

  mock(fnName: string, response: string | object): void;
  run(opts: { agent: string; framework?: string }): Promise<Trace>;
  export(lang?: "pytest" | "jest"): string;
}

interface Trace {
  stepCount: number;
  status: "success" | "failed" | "running";
  steps: Step[];
}
\`\`\`

## ESM and CJS

Both are supported. The package \`exports\` field routes automatically:

\`\`\`javascript
// ESM
import { trace } from "@replayai/sdk";

// CJS
const { trace } = require("@replayai/sdk");
\`\`\`

## Edge runtime caveats

The SDK uses the Node \`fs\` module for local storage and \`fetch\` for cloud sync. On edge runtimes (Cloudflare Workers, Vercel Edge), local storage is unavailable — use cloud mode only:

\`\`\`typescript
import { configure } from "@replayai/sdk";

configure({ storage: "cloud", token: process.env.REPLAYAI_TOKEN! });
\`\`\`
`;

const sdkConfig = `# Configuration

The SDK is configured via environment variables, a config file, or programmatic settings — in that order of precedence.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| \`REPLAYAI_PROJECT\` | — | Default project slug/id when \`trace()\` omits it |
| \`REPLAYAI_TOKEN\` | — | Cloud API token (required for cloud sync) |
| \`REPLAYAI_STORAGE\` | \`local\` | \`local\`, \`cloud\`, or \`both\` |
| \`REPLAYAI_STORAGE_PATH\` | \`./replays\` | Local storage directory |
| \`REPLAYAI_API_URL\` | \`https://api.replayai.dev\` | Cloud API base URL |
| \`REPLAYAI_DASHBOARD_URL\` | \`http://localhost:7373\` | Where \`replayai ui\` opens |
| \`REPLAYAI_REDACT_PATTERNS\` | built-in set | Comma-separated regex patterns to redact from recordings |
| \`REPLAYAI_SAMPLE_RATE\` | \`1.0\` | Fraction of sessions to record (0.0–1.0) |
| \`REPLAYAI_LIVE_LLM\` | \`false\` | Default for replay \`live_llm\` mode |
| \`REPLAYAI_STRICT\` | \`false\` | Raise on recording failures instead of warning |

## Config file

\`\`\`bash
# replayai.config.toml — placed in your project root
project = "support-agent"
storage = "both"
storage_path = "./replays"
sample_rate = 1.0

[redact]
patterns = [
  "sk-[a-zA-Z0-9]{20,}",     # OpenAI keys
  "Bearer [a-zA-Z0-9._-]+",  # auth tokens
  "password=[^&\\s]+",
  "[A-Z0-9]{28,}",           # generic long secrets
]

[cost_rates]  # per 1M tokens, USD — overrides built-in rates
"gpt-4o" = { in = 2.5, out = 10 }
"gpt-4o-mini" = { in = 0.15, out = 0.6 }
"claude-3.5-sonnet" = { in = 3.0, out = 15.0 }
\`\`\`

## Programmatic configuration

\`\`\`python
import replayai

replayai.configure(
    project="support-agent",
    storage="both",
    storage_path="./replays",
    token="rai_live_...",
    sample_rate=1.0,
    redact_patterns=[r"sk-[a-zA-Z0-9]{20,}"],
)
\`\`\`

\`\`\`typescript
import { configure } from "@replayai/sdk";

configure({
  project: "support-agent",
  storage: "both",
  storagePath: "./replays",
  token: process.env.REPLAYAI_TOKEN!,
  sampleRate: 1.0,
  redactPatterns: [/sk-[a-zA-Z0-9]{20,}/],
});
\`\`\`

## Sampling

In production you may not want to record every run (cost, storage, latency). Set \`REPLAYAI_SAMPLE_RATE\` to a fraction:

\`\`\`bash
# Record 10% of runs in production
REPLAYAI_SAMPLE_RATE=0.1

# Always record failures, even at low sample rates
# (set in config file)
[recording]
sample_rate = 0.1
always_record_failures = true
\`\`\`

When \`always_record_failures\` is on (default), any session that ends in \`failed\` status is recorded regardless of the sample rate — so you never miss the runs you most want to debug.

## Cost estimation

The SDK estimates cost from token counts and per-model rates. Built-in rates cover OpenAI and Anthropic models; for others, add entries to \`[cost_rates]\` in your config:

\`\`\`toml
[cost_rates]
"my-finetune" = { in = 1.0, out = 4.0 }
\`\`\`

If the model is unknown, cost is estimated as zero and a warning is logged. You can always override cost on a per-session basis via the [API](?view=developers&doc=api-sessions).

## Redaction

Secrets are redacted from recordings before they're written. The default patterns catch common API key formats. Add your own for internal secret shapes:

\`\`\`bash
REPLAYAI_REDACT_PATTERNS="mycompany_key_[a-z0-9]{32},internal_token_[a-f0-9]+"
\`\`\`

Redacted values are replaced with \`[REDACTED]\` in both input and output fields. The original is never written to disk or sent to the cloud.
`;

const langchain = `# LangChain Guide

LangChain is the most popular framework for building LLM agents in Python. ReplayAI's LangChain extra auto-instruments every LLM call, tool call, and retrieval — no code changes to your agent logic.

## Install

\`\`\`bash
pip install "replayai[langchain]"
\`\`\`

This installs \`langchain-core\` as a dependency and registers a callback handler that the tracer uses.

## Wrap a chain

For simple chains (no agent loop), wrap the invocation:

\`\`\`python
from replayai.integrations.langchain import trace_chain

@trace_chain("docs-qa", project="docs-qa", tags=["rag"])
def answer(question: str) -> str:
    return rag_chain.invoke(question)

answer("How many PTO days carry over?")
\`\`\`

Every component inside \`rag_chain\` — the retriever, the prompt formatting, the LLM call — is recorded as a step.

## Wrap an agent

Agents (with tool-calling loops) work the same way:

\`\`\`python
from replayai.integrations.langchain import trace_agent
from langchain.agents import create_openai_tools_agent, AgentExecutor

agent = create_openai_tools_agent(llm, tools, prompt)
executor = AgentExecutor(agent=agent, tools=tools, verbose=True)

@trace_agent("support-agent-v3", project="support-agent", tags=["production"])
def handle_support_ticket(message: str) -> str:
    return executor.invoke({"input": message})["output"]

handle_support_ticket("I was charged twice, refund me.")
\`\`\`

This records:
- Each LLM call (intent classification, response drafting, retries)
- Each tool call (\`lookup_customer\`, \`get_charges\`, \`issue_refund\`, …)
- Each retrieval (if your agent uses a retriever)
- The decision points where the agent chose which tool to call

## What you'll see in the dashboard

After a run, open the session. The timeline shows the agent's execution as a sequence of color-coded segments:

- **Emerald** — LLM calls (intent classification, response drafting)
- **Sky** — tool calls (\`lookup_customer\`, \`issue_refund\`)
- **Violet** — retrievals (RAG policy lookup)
- **Amber** — decisions (routing)
- **Rose** — errors (the failed \`issue_refund\` call)

Click any step to see its full input and output. For a failing run, the error step shows exactly what the tool returned — no more guessing why the agent "decided" to retry.

## The common LangChain failure mode

The most common LangChain agent bug: the agent **hallucinates a tool argument**. Here's the pattern ReplayAI catches:

\`\`\`text
Step 5 (LLM): "I'll process the refund of $24.00."
Step 6 (Tool): issue_refund() → ERROR 403: requires approval_id
Step 7 (LLM): "I'll retry with approval_id='mgr_auto_2024'"  ← HALLUCINATED
Step 8 (Tool): issue_refund(retry) → ERROR 401: invalid token
\`\`\`

Without ReplayAI, you'd see the final error in your logs and have no idea the agent fabricated an approval token. With the timeline, step 7's output makes the hallucination obvious — and you can replay it to test your fix.

## Using callbacks directly (advanced)

If you already use LangChain callbacks and don't want the decorator, you can attach the handler manually:

\`\`\`python
from replayai.integrations.langchain import ReplayCallbackHandler
from langchain.agents import AgentExecutor

handler = ReplayCallbackHandler(name="support-agent-v3", project="support-agent")

executor = AgentExecutor(
    agent=agent,
    tools=tools,
    callbacks=[handler],
    verbose=True,
)

# handler.flush() is called automatically on chain end
result = executor.invoke({"input": message})
\`\`\`

## Streaming

Streaming responses are recorded as a single step with the full aggregated output — not one step per token. The \`durationMs\` reflects the full stream time.

\`\`\`python
@trace_agent("streaming-agent")
def stream_answer(message: str):
    for chunk in agent.stream(message):
        print(chunk, end="", flush=True)
\`\`\`

## LangGraph

LangGraph agents work out of the box — the tracer records each node invocation as a step. For graph-specific metadata (which edge was taken), use the \`trace_graph\` helper:

\`\`\`python
from replayai.integrations.langchain import trace_graph

@trace_graph("research-graph", project="research-agent")
def run_research(topic: str):
    return graph.invoke({"topic": topic})
\`\`\`

This adds \`decision\` steps for each edge traversal, so the timeline shows the graph's branching structure.
`;

const crewai = `# CrewAI Guide

CrewAI runs multi-agent crews where agents collaborate on tasks. ReplayAI's CrewAI extra records every agent's LLM calls, tool calls, and task handoffs — so you can see exactly which agent in the crew broke.

## Install

\`\`\`bash
pip install "replayai[crewai]"
\`\`\`

## Wrap a crew

\`\`\`python
from replayai.integrations.crewai import trace_crew

researcher = Agent(
    role="Researcher",
    goal="Find competitor pricing data",
    llm=ChatOpenAI(model="claude-3.5-sonnet"),
    tools=[web_search, fetch_page],
)

analyst = Agent(
    role="Analyst",
    goal="Synthesize a comparison table",
    llm=ChatOpenAI(model="claude-3.5-sonnet"),
)

crew = Crew(
    agents=[researcher, analyst],
    tasks=[
        Task(description="Find pricing for 5 observability tools", agent=researcher),
        Task(description="Build a comparison table", agent=analyst),
    ],
    process=Process.sequential,
)

@trace_crew("research-agent-v2", project="research-agent", tags=["batch"])
def run_research(topic: str) -> str:
    return crew.kickoff(inputs={"topic": topic})

run_research("AI agent observability pricing")
\`\`\`

## What gets recorded

Each agent's actions are recorded as steps, prefixed with the agent's role:

- \`[Researcher] Decompose research question\` — LLM call
- \`[Researcher] web_search('AI agent observability pricing')\` — tool call
- \`[Researcher] Fetch & chunk pricing pages\` — retrieval (if using a RAG tool)
- \`[Researcher] Extract pricing per vendor\` — LLM call
- \`[Analyst] Synthesize comparison table\` — LLM call

Task handoffs appear as \`decision\` steps showing which agent received the task and what context was passed.

## Debugging crew failures

CrewAI's most common failure: one agent produces output the next agent can't parse, causing a loop or a crash. The timeline makes this visible:

\`\`\`text
Step 4 (LLM, Researcher): "5 vendor pricing cards extracted (JSON)"
Step 5 (Decision): task handoff → Analyst
Step 6 (LLM, Analyst): "I couldn't parse the pricing data. Retrying."  ← PARSE FAIL
Step 7 (LLM, Analyst): "I couldn't parse the pricing data. Retrying."  ← LOOP
Step 8 (Error): max_iterations exceeded
\`\`\`

Diff this run against a successful one to see exactly where the Researcher's output format diverged from what the Analyst expected.

## Delegation

CrewAI's delegation feature (agents handing tasks to each other mid-run) is recorded as nested decision steps. The timeline shows the delegation chain so you can trace which agent delegated to whom.

\`\`\`python
manager = Agent(
    role="Manager",
    goal="Coordinate the research",
    allow_delegation=True,
    llm=ChatOpenAI(model="gpt-4o"),
)
\`\`\`

## Per-agent tracing

If you want to trace a single agent in isolation (useful for unit testing one agent's behavior):

\`\`\`python
from replayai.integrations.crewai import trace_agent

@trace_agent("researcher-solo", project="research-agent")
def research(topic: str) -> str:
    return researcher.execute_task(Task(description=f"Research {topic}"))
\`\`\`

## CrewAI + tools

CrewAI tools (built-in or custom) are recorded automatically. For custom tools, make sure they're decorated with \`@tool\` so CrewAI exposes their schema — ReplayAI uses the schema to name the step:

\`\`\`python
from crewai_tools import tool

@tool("Fetch Pricing Page")
def fetch_pricing_page(url: str) -> str:
    """Fetch the pricing page at the given URL and return its text."""
    return httpx.get(url).text
\`\`\`

The step will be named \`Fetch Pricing Page\` in the timeline, with \`url\` as the input and the page text as the output.
`;

const llamaindex = `# LlamaIndex Guide

LlamaIndex is the leading framework for RAG applications. ReplayAI's LlamaIndex extra records every retrieval, every LLM call, and every synthesis step.

## Install

\`\`\`bash
pip install "replayai[llama_index]"
\`\`\`

## Wrap a query engine

\`\`\`python
from replayai.integrations.llama_index import trace_query_engine

index = VectorStoreIndex.from_documents(documents)
query_engine = index.as_query_engine(similarity_top_k=4)

@trace_query_engine("docs-qa", project="docs-qa", tags=["rag"])
def answer(question: str) -> str:
    return query_engine.query(question).response

answer("How many PTO days carry over?")
\`\`\`

This records:
- The embedding + vector search (as a \`retrieval\` step, with the returned chunks as output)
- The prompt construction
- The LLM call (with full prompt and completion)
- The response synthesis

## Wrap a chat engine

Chat engines (with memory) work the same way — each turn is a session:

\`\`\`python
from replayai.integrations.llama_index import trace_chat_engine

chat_engine = index.as_chat_engine(chat_mode="context")

@trace_chat_engine("docs-chat", project="docs-qa")
def chat(message: str) -> str:
    return chat_engine.chat(message).response
\`\`\`

## What gets recorded for retrieval

The \`retrieval\` step's output shows the actual chunks returned, their similarity scores, and their source nodes:

\`\`\`text
Step 1 (RAG): Embed query & search
  input:  query = 'How many PTO days carry over?'
  output: Top-4 chunks (cosine 0.82–0.91) from /hr/handbook
          - chunk[0] (0.91): "Employees may carry over up to 5 PTO days..."
          - chunk[1] (0.87): "Carryover days must be used by March 31..."
          - chunk[2] (0.84): "PTO policy applies to all full-time staff..."
          - chunk[3] (0.82): "Part-time staff accrue PTO proportionally..."
\`\`\`

This is invaluable for debugging "why did the RAG answer wrong?" — you see exactly what the retriever returned, not just the final answer.

## Debugging retrieval quality

The most common RAG failure: the retriever returns irrelevant chunks, and the LLM hallucinates from them. The timeline shows this clearly:

\`\`\`text
Step 1 (RAG): query='refund policy' → chunks about PTO and onboarding (low similarity)
Step 2 (LLM): "Based on the policy, refunds are processed in 5 days..." ← HALLUCINATED
\`\`\`

Fix the retriever (better chunking, hybrid search, reranking) and re-run. Diff the before/after sessions to confirm the retrieved chunks improved.

## Custom retrievers

If you use a custom retriever (e.g. a hybrid search with a reranker), wrap it so ReplayAI records it as a single retrieval step:

\`\`\`python
from replayai import record_step

class HybridRetriever:
    def retrieve(self, query: str):
        with record_step(
            type="retrieval",
            name="hybrid_search",
            input=f"query = {query!r}",
        ):
            vector_results = self.vector_index.retrieve(query)
            keyword_results = self.keyword_index.retrieve(query)
            merged = self.reranker.rerank(query, vector_results + keyword_results)
            return merged[:4]
\`\`\`

The step's output will be the merged, reranked chunks.
`;

const customAgents = `# Custom Agents

Not using a framework? ReplayAI works with any agent — including hand-rolled ones built directly on the OpenAI or Anthropic SDK.

## The minimal pattern

Wrap your agent's entry point with \`trace()\` and record each step manually:

\`\`\`python
import openai
from replayai import trace, record_step

client = openai.OpenAI()

@trace("support-agent-v3", project="support-agent", framework="Custom")
def handle_support_ticket(message: str) -> str:
    # 1. Classify intent (LLM call)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "Classify the intent."},
            {"role": "user", "content": message},
        ],
    )
    intent = resp.choices[0].message.content
    record_step(
        type="llm_call",
        name="Classify intent",
        model="gpt-4o-mini",
        tokens_in=resp.usage.prompt_tokens,
        tokens_out=resp.usage.completion_tokens,
        input=message,
        output=intent,
        status="success",
    )

    # 2. Lookup customer (tool call)
    customer = lookup_customer(extract_email(message))
    record_step(
        type="tool_call",
        name="lookup_customer(email)",
        input=f"email = {extract_email(message)}",
        output=customer.model_dump_json(),
        status="success",
    )

    # 3. Draft response (LLM call)
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": "Draft a response."},
            {"role": "user", "content": f"intent={intent}, customer={customer}"},
        ],
    )
    response = resp.choices[0].message.content
    record_step(
        type="llm_call",
        name="Draft response",
        model="gpt-4o",
        tokens_in=resp.usage.prompt_tokens,
        tokens_out=resp.usage.completion_tokens,
        input=f"intent={intent}, customer={customer}",
        output=response,
        status="success",
    )

    return response
\`\`\`

## A helper to reduce boilerplate

Manual \`record_step\` calls get verbose. Wrap your LLM and tool calls:

\`\`\`python
from contextlib import contextmanager
import time
from replayai import record_step

@contextmanager
def step(type_: str, name: str, **kwargs):
    """Context manager that records a step with automatic timing."""
    start = time.perf_counter()
    try:
        yield
    except Exception as e:
        record_step(
            type=type_,
            name=name,
            status="failed",
            duration_ms=int((time.perf_counter() - start) * 1000),
            output=f"ERROR: {e}",
            **kwargs,
        )
        raise
    else:
        record_step(
            type=type_,
            name=name,
            status="success",
            duration_ms=int((time.perf_counter() - start) * 1000),
            **kwargs,
        )

# Usage
with step("llm_call", "Classify intent",
          model="gpt-4o-mini", input=message,
          tokens_in=resp.usage.prompt_tokens, tokens_out=resp.usage.completion_tokens,
          output=intent):
    resp = client.chat.completions.create(...)
    intent = resp.choices[0].message.content
\`\`\`

## Wrapping the OpenAI client directly

For a zero-boilerplate approach, monkey-patch (or wrap) the OpenAI client so every call is recorded:

\`\`\`python
import openai
from replayai import record_step

class TracedOpenAI:
    def __init__(self):
        self._client = openai.OpenAI()

    @property
    def chat(self):
        return TracedChat(self._client.chat)

class TracedChat:
    def __init__(self, chat):
        self.completions = TracedCompletions(chat.completions)

class TracedCompletions:
    def __init__(self, completions):
        self._completions = completions

    def create(self, **kwargs):
        resp = self._completions.create(**kwargs)
        record_step(
            type="llm_call",
            name=kwargs.get("model", "unknown") + " call",
            model=kwargs.get("model"),
            tokens_in=resp.usage.prompt_tokens,
            tokens_out=resp.usage.completion_tokens,
            input=str(kwargs.get("messages", "")),
            output=resp.choices[0].message.content,
            status="success",
        )
        return resp

client = TracedOpenAI()
\`\`\`

Now every \`client.chat.completions.create()\` is recorded automatically — no manual steps needed. This is essentially what the framework extras do, generalized.

## Anthropic SDK

The same wrapper pattern works for Anthropic:

\`\`\`python
import anthropic

client = anthropic.Anthropic()

@trace("claude-agent", project="my-project")
def run(message: str) -> str:
    with step("llm_call", "Generate response", model="claude-3.5-sonnet"):
        resp = client.messages.create(
            model="claude-3.5-sonnet",
            max_tokens=1024,
            messages=[{"role": "user", "content": message}],
        )
        return resp.content[0].text
\`\`\`
`;

const ciCd = `# CI/CD Integration

The real value of ReplayAI is catching regressions before they reach production. This guide shows how to run replay tests in CI and gate deploys on them.

## GitHub Actions

Add a step that runs your exported replay tests after your unit tests:

\`\`\`yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r requirements.txt
      - run: pip install replayai pytest

      - name: Run unit tests
        run: pytest tests/unit/

      - name: Run replay regression tests
        run: pytest tests/replay/
        env:
          REPLAYAI_STORAGE: cloud
          REPLAYAI_TOKEN: \${{ secrets.REPLAYAI_TOKEN }}
          # Replays are deterministic — no API keys needed
          # The token is only for fetching the recording from cloud storage
\`\`\`

Replay tests run with **no LLM API keys** — every call is mocked from the recording. This means:

- CI is free (no model inference)
- CI is fast (no network latency for LLM calls)
- CI is deterministic (no flaky tests from model non-determinism)

## The replay test directory

Organize exported tests by scenario:

\`\`\`text
tests/
  unit/
    test_classifier.py
    test_tools.py
  replay/
    test_support_refund_failed.py        # exported from ses_8fa1
    test_support_refund_fixed.py         # exported from ses_2c7e
    test_research_competitor_pricing.py  # exported from ses_9bd0
    test_sales_enrichment_loop.py        # exported from ses_4f2a
\`\`\`

Each test asserts the agent produces the same step sequence and status as the original recording. When you change your agent and a step diverges, the test fails with a clear diff.

## Pre-deploy replay gate

For agents in production, gate deploys on replay tests passing:

\`\`\`yaml
- name: Deploy gate
  if: github.ref == 'refs/heads/main'
  run: |
    if ! pytest tests/replay/ --tb=short; then
      echo "::error::Replay regression tests failed — deploy blocked."
      echo "::error::A recorded scenario no longer reproduces. Fix the agent or update the baseline."
      exit 1
    fi
\`\`\`

## PR regression reports

Use the ReplayAI GitHub Action to post a diff comment on PRs that change agent behavior:

\`\`\`yaml
- uses: replayai/regression-action@v1
  with:
    token: \${{ secrets.REPLAYAI_TOKEN }}
    project: support-agent
    # Runs all replay tests for this project and comments with any divergences
\`\`\`

The action posts a comment like:

> **Replay regression detected**
> 2 of 12 scenarios diverged on this branch:
> - \`test_support_refund_failed\` — step 7 output changed (was "hallucinated token", now "approval requested")
> - \`test_research_competitor_pricing\` — step 4 token count increased (was 6200, now 8100)
> [View full diff →](https://app.replayai.dev/diff/pr-1234)

## Live LLM drift detection

Once a week, run replays in live-LLM mode to catch model drift (when OpenAI/Anthropic silently change model behavior):

\`\`\`yaml
# .github/workflows/drift.yml
name: Model drift check
on:
  schedule:
    - cron: "0 9 * * 1"  # every Monday 9am UTC

jobs:
  drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install replayai pytest
      - run: pytest tests/replay/ --live-llm
        env:
          OPENAI_API_KEY: \${{ secrets.OPENAI_API_KEY }}
          REPLAYAI_TOKEN: \${{ secrets.REPLAYAI_TOKEN }}
\`\`\`

If a previously-passing replay now produces different output, you get an alert that your model provider changed something — before your users notice.

## GitLab CI / Jenkins / CircleCI

The pattern is the same: install the SDK, run \`pytest tests/replay/\`. No special runner needed — replays are just pytest tests.
`;

const apiOverview = `# API Overview & Authentication

The ReplayAI REST API lets you build custom integrations — ingest sessions from non-Python runtimes, build custom dashboards, or wire ReplayAI into your existing observability stack.

## Base URL

\`\`\`text
Local:    http://localhost:7373/api
Cloud:    https://api.replayai.dev/api
\`\`\`

All examples in this reference use the cloud URL. For local development, substitute \`http://localhost:7373\`.

## Authentication

Cloud mode uses bearer tokens. Get a token from **Settings → API Tokens** in the dashboard.

\`\`\`bash
curl https://api.replayai.dev/api/sessions \\
  -H "Authorization: Bearer rai_live_abc123"
\`\`\`

Local mode requires no authentication — the local store is single-tenant.

Tokens are scoped to a workspace. Within a workspace, a token can read all projects and write sessions. For finer-grained access (read-only, project-scoped), create a restricted token in settings.

## Content type

All request and response bodies are JSON (\`application/json\`). Upload endpoints (if any) use multipart form data.

\`\`\`bash
curl https://api.replayai.dev/api/sessions \\
  -H "Authorization: Bearer rai_live_abc123" \\
  -H "Content-Type: application/json"
\`\`\`

## Versioning

The API is versioned via URL prefix: \`/api/\` is the current stable version. Breaking changes ship under \`/api/v2/\` with at least 6 months of overlap. We never make breaking changes within a version.

## Rate limits

Cloud mode applies the following limits per token:

| Plan | Requests/min | Sessions/day |
| --- | --- | --- |
| Free | 60 | 100 |
| Pro | 600 | 10,000 |
| Enterprise | 6,000 | unlimited |

Rate-limited responses return \`429\` with a \`Retry-After\` header.

## Errors

Errors use standard HTTP status codes with a JSON body:

\`\`\`json
{
  "error": "Session not found"
}
\`\`\`

| Status | Meaning |
| --- | --- |
| 400 | Bad request — malformed JSON or missing required field |
| 401 | Unauthorized — missing or invalid token |
| 403 | Forbidden — token lacks scope for this operation |
| 404 | Not found — resource doesn't exist |
| 409 | Conflict — duplicate resource (e.g. project slug) |
| 429 | Rate limited |
| 500 | Server error — retry with backoff |

## SDK vs API

When should you use the SDK vs the API directly?

- **SDK** — instrumenting an agent (recording), running replays in tests. The SDK handles batching, retries, and redaction.
- **API** — building custom tooling: a Slack bot that alerts on failures, a Grafana panel of session stats, ingesting from a language without an SDK (Rust, Go).

The SDK is a thin wrapper over the API — everything the SDK does, you can do with raw HTTP.
`;

const apiProjects = `# Projects

Projects group sessions by agent deployment. List, create, and inspect projects.

## List projects

\`\`\`bash
curl https://api.replayai.dev/api/projects \\
  -H "Authorization: Bearer rai_live_abc123"
\`\`\`

\`\`\`json
{
  "projects": [
    {
      "id": "cmqjx4oi70000rmien4pqnwy1",
      "name": "Support Agent",
      "slug": "support-agent",
      "framework": "LangChain",
      "description": "Customer support agent handling billing, refunds, and account queries.",
      "createdAt": "2025-01-14T09:42:11.000Z",
      "sessionCount": 2
    }
  ]
}
\`\`\`

## Create a project

\`\`\`bash
curl -X POST https://api.replayai.dev/api/projects \\
  -H "Authorization: Bearer rai_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My New Agent",
    "framework": "LangChain",
    "description": "What this agent does."
  }'
\`\`\`

\`\`\`json
{
  "project": {
    "id": "cmqjx4oi70000rmien4pqnwy1",
    "name": "My New Agent",
    "slug": "my-new-agent",
    "framework": "LangChain",
    "description": "What this agent does.",
    "createdAt": "2025-01-14T09:42:11.000Z"
  }
}
\`\`\`

The \`slug\` is auto-derived from \`name\` (lowercased, hyphenated). If the slug collides with an existing project, the API returns \`409\`.

## Get a project

\`\`\`bash
curl https://api.replayai.dev/api/projects/support-agent \\
  -H "Authorization: Bearer rai_live_abc123"
\`\`\`

Returns \`404\` if no project has that slug.

## Fields

| Field | Type | Description |
| --- | --- | --- |
| \`id\` | string | Stable cuid |
| \`name\` | string | Human-readable name |
| \`slug\` | string | URL-safe identifier, unique |
| \`framework\` | string | \`LangChain\`, \`CrewAI\`, \`LlamaIndex\`, \`Custom\`, … |
| \`description\` | string \| null | Free-form description |
| \`createdAt\` | ISO 8601 | Creation timestamp |
| \`sessionCount\` | number | Included in list/get responses |
`;

const apiSessions = `# Sessions

Sessions are the core resource. List them with filters, fetch full details, ingest new recordings, update metadata, or delete.

## List sessions

\`\`\`bash
curl "https://api.replayai.dev/api/sessions?projectId=cmqjx4oi7&status=failed&limit=20" \\
  -H "Authorization: Bearer rai_live_abc123"
\`\`\`

### Query parameters

| Param | Default | Description |
| --- | --- | --- |
| \`projectId\` | — | Filter to a project |
| \`status\` | — | \`success\`, \`failed\`, or \`running\` |
| \`q\` | — | Full-text search on name, agent, and tags |
| \`limit\` | 100 | Max 200 |
| \`offset\` | 0 | Pagination offset |
| \`orderBy\` | \`startedAt\` | \`startedAt\`, \`durationMs\`, \`costUsd\`, or \`tokenTotal\` |
| \`withSteps\` | 0 | Set to \`1\` to include full step payloads (heavier) |

By default, list responses include a \`stepCount\` but not step payloads — fetch a single session for the full trace.

\`\`\`json
{
  "sessions": [
    {
      "id": "ses_8fa1",
      "projectId": "cmqjx4oi70000rmien4pqnwy1",
      "name": "Customer Support — Refund Query #4821",
      "agent": "support-agent-v3",
      "framework": "LangChain",
      "status": "failed",
      "startedAt": "2025-01-14T09:42:11.000Z",
      "durationMs": 18420,
      "tokenTotal": 7420,
      "costUsd": 0.094,
      "tags": ["production", "refund-flow", "regression"],
      "steps": [],
      "stepCount": 8
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
\`\`\`

## Get a session

\`\`\`bash
curl https://api.replayai.dev/api/sessions/ses_8fa1 \\
  -H "Authorization: Bearer rai_live_abc123"
\`\`\`

Returns the full session including all steps:

\`\`\`json
{
  "session": {
    "id": "ses_8fa1",
    "name": "Customer Support — Refund Query #4821",
    "status": "failed",
    "steps": [
      {
        "id": "st_1",
        "type": "llm_call",
        "name": "Classify intent",
        "t": 0,
        "durationMs": 820,
        "status": "success",
        "model": "gpt-4o-mini",
        "tokensIn": 312,
        "tokensOut": 24,
        "input": "User: 'I was charged twice...'",
        "output": "intent: billing_dispute · confidence: 0.94"
      }
      // ...7 more steps
    ]
  }
}
\`\`\`

## Ingest a session (SDK endpoint)

This is the endpoint the SDK calls when a \`trace()\` context exits. You can call it directly to ingest from any runtime.

\`\`\`bash
curl -X POST https://api.replayai.dev/api/sessions \\
  -H "Authorization: Bearer rai_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectSlug": "support-agent",
    "name": "Customer Support — Refund Query (live)",
    "agent": "support-agent-v3",
    "framework": "LangChain",
    "tags": ["production", "refund-flow"],
    "steps": [
      {
        "type": "llm_call",
        "name": "Classify intent",
        "t": 0,
        "durationMs": 820,
        "status": "success",
        "model": "gpt-4o-mini",
        "tokensIn": 312,
        "tokensOut": 24,
        "input": "User message...",
        "output": "intent: billing_dispute"
      },
      {
        "type": "tool_call",
        "name": "issue_refund",
        "t": 4960,
        "durationMs": 1180,
        "status": "failed",
        "input": "charge_id=ch_002",
        "output": "ERROR 403: requires approval_id"
      }
    ]
  }'
\`\`\`

The API derives \`tokenTotal\`, \`costUsd\`, \`durationMs\`, and \`status\` from the steps if you don't provide them. The response includes the full session as created.

## Update a session

\`\`\`bash
curl -X PATCH https://api.replayai.dev/api/sessions/ses_8fa1 \\
  -H "Authorization: Bearer rai_live_abc123" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Renamed session",
    "tags": ["production", "investigated"]
  }'
\`\`\`

Updatable fields: \`name\`, \`status\`, \`tags\`. Step contents are immutable.

## Delete a session

\`\`\`bash
curl -X DELETE https://api.replayai.dev/api/sessions/ses_8fa1 \\
  -H "Authorization: Bearer rai_live_abc123"
\`\`\`

Returns \`200 { "ok": true }\`. Deletion cascades to all steps. This is irreversible.

## Session fields

| Field | Type | Description |
| --- | --- | --- |
| \`id\` | string | Stable identifier |
| \`projectId\` | string | Parent project |
| \`name\` | string | Human-readable name |
| \`agent\` | string | Agent identifier (e.g. \`support-agent-v3\`) |
| \`framework\` | string | \`LangChain\`, \`CrewAI\`, … |
| \`status\` | string | \`success\`, \`failed\`, \`running\` |
| \`startedAt\` | ISO 8601 | When the run began |
| \`durationMs\` | number | Wall-clock duration |
| \`tokenTotal\` | number | Sum of tokens across LLM calls |
| \`costUsd\` | number | Estimated cost |
| \`tags\` | string[] | Free-form labels |
| \`steps\` | Step[] | Ordered steps (full payload on get) |
| \`stepCount\` | number | Included in list responses |

## Step fields

| Field | Type | Description |
| --- | --- | --- |
| \`id\` | string | Step identifier |
| \`type\` | string | \`llm_call\`, \`tool_call\`, \`retrieval\`, \`decision\`, \`error\` |
| \`name\` | string | Human-readable name |
| \`t\` | number | Offset from session start (ms) |
| \`durationMs\` | number | Step duration |
| \`status\` | string | \`success\`, \`failed\`, \`running\`, \`warning\` |
| \`model\` | string \| null | Model name (LLM calls only) |
| \`tokensIn\` | number \| null | Input tokens (LLM calls only) |
| \`tokensOut\` | number \| null | Output tokens (LLM calls only) |
| \`input\` | string | Step input (args, prompt, query) |
| \`output\` | string | Step output (result, completion, error) |
`;

const apiExport = `# Export

Generate a runnable regression test from a recorded session. Supports pytest (Python) and jest (TypeScript).

## Generate test (as text)

\`\`\`bash
curl "https://api.replayai.dev/api/sessions/ses_8fa1/export?lang=pytest" \\
  -H "Authorization: Bearer rai_live_abc123"
\`\`\`

Returns the test file as plain text with \`Content-Type: text/x-python\`:

\`\`\`python
# Auto-generated by ReplayAI · session ses_8fa1
# Replays the exact recorded conditions of: Customer Support — Refund Query #4821
# pip install replayai
import pytest
from replayai import ReplaySession

REPLAY_ID = "ses_8fa1"


def test_customer_support_refund_query_4821(replay: ReplaySession):
    """Replay recorded agent execution with mocked tool/RAG responses.

    Original status: failed
    Original duration: 18.4s
    Steps recorded: 8
    """
    # --- Mocked deterministic responses (recorded from production) ---
    # step 1: lookup_customer(email) → success
    replay.mock("lookup_customer", '{"customer_id":"cus_8821",...}')
    # step 2: get_charges(customer_id) → success
    replay.mock("get_charges", '{"charges":[...]}')

    # --- Re-run the agent under recorded conditions ---
    with replay.trace() as trace:
        result = replay.run(agent="support-agent-v3", framework="LangChain")

    # --- Assertions based on the recorded baseline ---
    assert trace.step_count == 8
    assert trace.status == "failed"
\`\`\`

## Download as attachment

Add \`&download=1\` to get a \`Content-Disposition: attachment\` header, useful for "Download" buttons:

\`\`\`bash
curl -OJ "https://api.replayai.dev/api/sessions/ses_8fa1/export?lang=pytest&download=1" \\
  -H "Authorization: Bearer rai_live_abc123"
# Saves as: ses_8fa1.py
\`\`\`

## jest output

Set \`lang=jest\` for TypeScript:

\`\`\`bash
curl "https://api.replayai.dev/api/sessions/ses_8fa1/export?lang=jest" \\
  -H "Authorization: Bearer rai_live_abc123"
\`\`\`

\`\`\`typescript
// Auto-generated by ReplayAI · session ses_8fa1
// npm install @replayai/sdk
import { ReplaySession } from "@replayai/sdk";

const REPLAY_ID = "ses_8fa1";

describe("customer_support_refund_query_4821", () => {
  it("replays recorded agent execution deterministically", async () => {
    const replay = new ReplaySession(REPLAY_ID);
    replay.mock("lookup_customer", '{"customer_id":"cus_8821",...}');

    const trace = await replay.run({
      agent: "support-agent-v3",
      framework: "LangChain",
    });

    expect(trace.stepCount).toBe(8);
    expect(trace.status).toBe("failed");
  });
});
\`\`\`

## What gets mocked

Only \`tool_call\` and \`retrieval\` steps become mocks — these are the deterministic external calls. \`llm_call\` steps are replayed verbatim from the recording by default (toggle \`live_llm\` to re-invoke them).

## Query parameters

| Param | Default | Description |
| --- | --- | --- |
| \`lang\` | \`pytest\` | \`pytest\` or \`jest\` |
| \`download\` | 0 | Set to \`1\` for attachment headers |

## Response headers

\`\`\`text
Content-Type: text/x-python        # or text/typescript
Content-Disposition: attachment; filename="ses_8fa1.py"  # only when download=1
Cache-Control: no-store
\`\`\`
`;

const apiStats = `# Stats

Aggregate statistics across your workspace. Powers the dashboard's overview strip and is useful for custom monitoring.

## Get workspace stats

\`\`\`bash
curl https://api.replayai.dev/api/stats \\
  -H "Authorization: Bearer rai_live_abc123"
\`\`\`

\`\`\`json
{
  "totalSessions": 5,
  "failedSessions": 2,
  "successSessions": 3,
  "runningSessions": 0,
  "totalSteps": 29,
  "totalTokens": 59200,
  "totalCost": 0.806,
  "projects": 4,
  "failRate": 40,
  "last30": [
    { "status": "success", "count": 3 },
    { "status": "failed", "count": 2 }
  ],
  "recentIds": ["ses_2c7e", "ses_1e8c", "ses_8fa1", "ses_9bd0", "ses_4f2a"]
}
\`\`\`

## Fields

| Field | Type | Description |
| --- | --- | --- |
| \`totalSessions\` | number | All sessions in workspace |
| \`failedSessions\` | number | Sessions with \`status: failed\` |
| \`successSessions\` | number | Sessions with \`status: success\` |
| \`runningSessions\` | number | Sessions with \`status: running\` |
| \`totalSteps\` | number | All steps across all sessions |
| \`totalTokens\` | number | Sum of tokens across all LLM calls |
| \`totalCost\` | number | Estimated cost (USD) |
| \`projects\` | number | Project count |
| \`failRate\` | number | Percentage (0–100) |
| \`last30\` | array | Session counts by status in the last 30 days |
| \`recentIds\` | string[] | IDs of the 5 most recent sessions |

## Use cases

### Alert on failure rate spike

Poll \`/api/stats\` every minute and alert when \`failRate\` exceeds a threshold:

\`\`\`python
import httpx

stats = httpx.get(
    "https://api.replayai.dev/api/stats",
    headers={"Authorization": f"Bearer {token}"},
).json()

if stats["failRate"] > 25:
    alert_slack(f"ReplayAI fail rate spiked to {stats['failRate']}%")
\`\`\`

### Grafana panel

Point Grafana's JSON API data source at \`/api/stats\` to chart session volume, fail rate, and cost over time.

### Daily digest

A cron job that fetches stats and emails a summary:

\`\`\`text
ReplayAI daily digest — 2025-01-14
Sessions recorded: 1,204 (+12% vs yesterday)
Fail rate: 8.3% (↑2.1pp)
Cost: $42.18 (↑8%)
Top failing agent: support-agent-v3 (47 failures)
\`\`\`
`;

const apiWebhooks = `# Webhooks

ReplayAI emits realtime events when sessions are created, updated, or deleted. Subscribe to them via WebSocket (for dashboards) or webhooks (for server-side integrations).

## WebSocket (realtime)

For browser dashboards and live UIs, connect to the WebSocket endpoint:

\`\`\`javascript
import { io } from "socket.io-client";

const socket = io("/?XTransformPort=3003", {
  transports: ["websocket", "polling"],
});

socket.on("session:created", (data) => {
  console.log("New session:", data.session.id, data.session.name);
});

socket.on("session:updated", (data) => {
  console.log("Session updated:", data.session.id);
});

socket.on("session:deleted", (data) => {
  console.log("Session deleted:", data.id);
});
\`\`\`

### Events

| Event | Payload | When |
| --- | --- | --- |
| \`session:created\` | \`{ session: Session }\` | A new session is ingested |
| \`session:updated\` | \`{ session: Session }\` | A session's name/status/tags change |
| \`session:deleted\` | \`{ id: string }\` | A session is deleted |

The WebSocket is fire-and-forget — events may be missed during reconnects. For guaranteed delivery, use HTTP webhooks.

## HTTP webhooks (server-side)

For server-side integrations (Slack alerts, PagerDuty, custom DB sync), register a webhook URL in **Settings → Webhooks**. ReplayAI POSTs events to your URL:

\`\`\`bash
POST https://your-app.com/webhooks/replayai
Content-Type: application/json
X-ReplayAI-Event: session:created
X-ReplayAI-Signature: sha256=...

{
  "event": "session:created",
  "session": { ... },
  "timestamp": "2025-01-14T09:42:11.000Z"
}
\`\`\`

### Verifying the signature

Each webhook is signed with HMAC-SHA256 using your webhook secret. Verify before processing:

\`\`\`python
import hmac
import hashlib

def verify_signature(payload: bytes, signature: str, secret: str) -> bool:
    expected = "sha256=" + hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, signature)
\`\`\`

\`\`\`typescript
import crypto from "node:crypto";

function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): boolean {
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature),
  );
}
\`\`\`

## Slack alert on failure

A webhook handler that alerts Slack when a session fails:

\`\`\`typescript
import express from "express";

const app = express();

app.post("/webhooks/replayai", express.raw({ type: "*/*" }), (req, res) => {
  const signature = req.headers["x-replayai-signature"] as string;
  if (!verifySignature(req.body, signature, process.env.REPLAYAI_WEBHOOK_SECRET!)) {
    return res.status(401).send("invalid signature");
  }

  const event = req.headers["x-replayai-event"];
  const { session } = JSON.parse(req.body);

  if (event === "session:created" && session.status === "failed") {
    fetch("https://hooks.slack.com/services/...", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: "Agent failure: " + session.name,
        attachments: [{
          color: "danger",
          text: "Status: " + session.status + " · " + session.steps.length + " steps · $" + session.costUsd,
          actions: [{
            type: "button",
            text: "Replay",
            url: "https://app.replayai.dev/s/" + session.id,
          }],
        }],
      }),
    });
  }

  res.status(200).send("ok");
});
\`\`\`

## Retry behavior

Webhooks that return non-2xx are retried with exponential backoff: 1s, 5s, 30s, 2m, 10m. After 5 failures, the webhook is disabled and you get an email.

## Event ordering

Events for the same session are delivered in order. Events across different sessions may arrive out of order. Use the \`timestamp\` field if you need global ordering.

## Idempotency

Webhook deliveries are not guaranteed to be exactly-once. Your handler must be idempotent — deduplicate by \`session.id\` + \`event\` + \`timestamp\` if needed.
`;

export const DOCS: Record<string, DocPage> = {
  introduction: { slug: "introduction", title: "Introduction", description: "What ReplayAI is and why it exists.", category: "Getting Started", content: introduction },
  installation: { slug: "installation", title: "Installation", description: "Install the Python and TypeScript SDKs and the dashboard.", category: "Getting Started", content: installation },
  quickstart: { slug: "quickstart", title: "Quick Start", description: "Record and replay your first session in 5 minutes.", category: "Getting Started", content: quickstart },
  concepts: { slug: "concepts", title: "Core Concepts", description: "Projects, sessions, steps, and replay — the four primitives.", category: "Getting Started", content: concepts },

  "sdk-python": { slug: "sdk-python", title: "Python SDK", description: "trace(), record_step(), ReplaySession — the full Python API.", category: "SDK Reference", content: sdkPython },
  "sdk-typescript": { slug: "sdk-typescript", title: "TypeScript SDK", description: "trace(), withTrace(), ReplaySession — the full TS API.", category: "SDK Reference", content: sdkTypescript },
  "sdk-config": { slug: "sdk-config", title: "Configuration", description: "Environment variables, config file, sampling, redaction.", category: "SDK Reference", content: sdkConfig },

  langchain: { slug: "langchain", title: "LangChain", description: "Auto-instrument LangChain chains and agents.", category: "Guides", content: langchain },
  crewai: { slug: "crewai", title: "CrewAI", description: "Auto-instrument CrewAI crews and agents.", category: "Guides", content: crewai },
  llamaindex: { slug: "llamaindex", title: "LlamaIndex", description: "Auto-instrument LlamaIndex query and chat engines.", category: "Guides", content: llamaindex },
  "custom-agents": { slug: "custom-agents", title: "Custom Agents", description: "Instrument hand-rolled agents built on OpenAI/Anthropic SDKs.", category: "Guides", content: customAgents },
  "ci-cd": { slug: "ci-cd", title: "CI/CD Integration", description: "Run replay tests in CI and gate deploys on regressions.", category: "Guides", content: ciCd },

  "api-overview": { slug: "api-overview", title: "Overview & Auth", description: "Base URL, authentication, versioning, rate limits, errors.", category: "API Reference", content: apiOverview },
  "api-projects": { slug: "api-projects", title: "Projects", description: "List, create, and inspect projects.", category: "API Reference", content: apiProjects },
  "api-sessions": { slug: "api-sessions", title: "Sessions", description: "List, get, ingest, update, and delete sessions.", category: "API Reference", content: apiSessions },
  "api-export": { slug: "api-export", title: "Export", description: "Generate pytest/jest tests from recorded sessions.", category: "API Reference", content: apiExport },
  "api-stats": { slug: "api-stats", title: "Stats", description: "Workspace aggregate statistics.", category: "API Reference", content: apiStats },
  "api-webhooks": { slug: "api-webhooks", title: "Webhooks", description: "Realtime WebSocket and HTTP webhook events.", category: "API Reference", content: apiWebhooks },
};

// Flattened ordered list (for prev/next navigation)
export const DOC_ORDER: string[] = DOC_NAV.flatMap((c) => c.pages.map((p) => p.slug));
