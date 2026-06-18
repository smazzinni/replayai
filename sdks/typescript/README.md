# @replayai/sdk

TypeScript SDK for [ReplayAI](https://github.com/replayai) — instrument JS/TS agents, record sessions, and replay/export them as tests.

- **Zero runtime deps.** Node 18+ built-ins only (`fetch`, `AsyncLocalStorage`, `crypto`).
- **ESM + CJS** via the `exports` map.
- **Async-safe** current-session tracking via `AsyncLocalStorage`.

## Install

```bash
bun add @replayai/sdk
# or
npm install @replayai/sdk
```

## 30-second usage

```typescript
import { withTrace, recordStep, configure } from "@replayai/sdk";

// Point at a running ReplayAI app (default: http://localhost:3000)
configure({ apiUrl: "http://localhost:3000" });

await withTrace(
  "support-agent-v3",
  { project: "support-agent", tags: ["production"] },
  async () => {
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
  },
);
// → session POSTed to /api/sessions and visible in the dashboard.
```

## API

### `trace(name, opts?, fn)` — higher-order function

Wraps an existing function so each call records a session.

```typescript
import { trace } from "@replayai/sdk";

export const handleSupportTicket = trace(
  "support-agent-v3",
  { project: "support-agent", tags: ["production"] },
  async (message: string): Promise<string> => {
    const intent = await classifyIntent(message);
    const customer = await lookupCustomer(message);
    return reply;
  },
);
```

### `withTrace(name, opts?, fn)` — async context manager

```typescript
await withTrace("research-agent-v2", { tags: ["batch"] }, async () => {
  const result = await crew.kickoff({ topic: "AI observability pricing" });
  return result;
});
```

### `recordStep({ type, name, model?, tokensIn?, tokensOut?, input?, output?, status?, durationMs? })`

Appends a step to the current session. No-op outside a trace (unless `strict: true`).

```typescript
await recordStep({
  type: "tool_call",
  name: "issue_refund",
  input: JSON.stringify({ charge_id: "ch_002" }),
  output: JSON.stringify({ refund_id: "ref_3391" }),
  status: "success",
});
```

### `ReplaySession`

Load a recorded session and either re-run it or export it as a test.

```typescript
import { ReplaySession } from "@replayai/sdk";

const replay = new ReplaySession("ses_8fa1", { liveLlm: false });

replay.mock("issue_refund", JSON.stringify({ refund_id: "ref_3391" }));

const trace = await replay.run({ agent: "support-agent-v3", framework: "LangChain" });
console.log(trace.stepCount, trace.status);

const code = await replay.export("pytest"); // or "jest"
```

### `configure(opts)`

Programmatic configuration. Same keys as the env vars below.

```typescript
configure({
  project: "support-agent",
  storage: "both",
  storagePath: "./replays",
  token: process.env.REPLAYAI_TOKEN!,
  apiUrl: "https://api.replayai.dev",
  sampleRate: 1.0,
  redactPatterns: [/sk-[a-zA-Z0-9]{20,}/],
});
```

### `VERSION`

```typescript
import { VERSION } from "@replayai/sdk";
console.log(VERSION); // "0.4.1"
```

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `REPLAYAI_PROJECT` | — | Default project slug/id when `trace()` omits it |
| `REPLAYAI_TOKEN` | — | Cloud API token (sent as `Authorization: Bearer`) |
| `REPLAYAI_STORAGE` | `cloud` | `local`, `cloud`, or `both` |
| `REPLAYAI_STORAGE_PATH` | `./replays` | Local storage directory |
| `REPLAYAI_API_URL` | `http://localhost:3000` | Cloud API base URL |
| `REPLAYAI_DASHBOARD_URL` | `http://localhost:3000` | Where session URLs point |
| `REPLAYAI_REDACT_PATTERNS` | built-in set | Comma-separated regex patterns to redact |
| `REPLAYAI_SAMPLE_RATE` | `1.0` | Fraction of sessions to record (0.0–1.0) |
| `REPLAYAI_STRICT` | `false` | Raise on recording failures instead of warning |

## Redaction

Secrets are scrubbed from step input/output before persistence. Default patterns catch `sk-...` (OpenAI keys), `Bearer ...` (auth tokens), `password=...`, and `api_key=...`. Redacted spans become `[REDACTED]`.

## ESM + CJS

Both are supported. The `exports` field routes automatically:

```javascript
// ESM
import { trace } from "@replayai/sdk";

// CJS
const { trace } = require("@replayai/sdk");
```

## License

MIT
