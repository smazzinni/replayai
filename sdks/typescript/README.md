# @smazzinni/sdk

[![npm version](https://img.shields.io/npm/v/@smazzinni/sdk?color=blue)](https://www.npmjs.com/package/@smazzinni/sdk)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

TypeScript SDK for [ReplayAI](https://github.com/smazzinni/replayai) — instrument JS/TS agents, record sessions, and view them in the built-in dashboard.

- **Zero runtime deps.** Node 18+ built-ins only (`fetch`, `AsyncLocalStorage`, `crypto`, `http`).
- **Built-in dashboard.** `npx replayai ui` launches a self-contained server — no external app or database required.
- **ESM + CJS** via the `exports` map.
- **Async-safe** current-session tracking via `AsyncLocalStorage`.

## Install

```bash
bun add @smazzinni/sdk
# or
npm install @smazzinni/sdk
```

## 30-second usage

```typescript
import { withTrace, recordStep, configure } from "@smazzinni/sdk";

// Store sessions locally so the built-in dashboard can show them.
configure({ storage: "local", storagePath: "./replays" });

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
```

## Launching the dashboard

The SDK ships with a self-contained dashboard server (Node built-ins only). Record sessions locally, then launch the UI:

```bash
# 1. Record a session (stored locally when storage=local)
#    Your code calls withTrace() + recordStep() as shown above.

# 2. Launch the dashboard
npx replayai ui
# → opens http://localhost:7373 in your browser
# → shows all locally-recorded sessions with full step timelines
```

Options:

| Flag | Default | Description |
| --- | --- | --- |
| `--port` | `7373` | Port to listen on |
| `--storage` | `./replays` | Local storage path |
| `--no-browser` | — | Don't auto-open the browser |

The dashboard reads sessions from `{storage}/sessions/*.json` and serves:
- `GET /` — single-page dashboard UI (stats, sessions list, step timeline)
- `GET /api/sessions` — JSON session list
- `GET /api/sessions/:id` — JSON single session with steps
- `GET /api/stats` — JSON aggregate stats

## CLI commands

```bash
replayai ui [--port 7373] [--storage ./replays] [--no-browser]  # Launch the dashboard
replayai version                                                # Print version
replayai help                                                   # Show help
```

## API

### `trace(name, opts?, fn)` — higher-order function

Wraps an existing function so each call records a session.

```typescript
import { trace } from "@smazzinni/sdk";

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
import { ReplaySession } from "@smazzinni/sdk";

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
import { VERSION } from "@smazzinni/sdk";
console.log(VERSION); // "0.7.0"
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
| `REPLAYAI_REDACT_STRICT` | `true` | Set `false` to disable entropy-based secret detection |
| `REPLAYAI_SAMPLE_RATE` | `1.0` | Fraction of sessions to record (0.0–1.0) |
| `REPLAYAI_STRICT` | `false` | Raise on recording failures instead of warning |
| `REPLAYAI_TIMEOUT` | `30000` | Per-request HTTP timeout (ms) |
| `REPLAYAI_MAX_STEPS` | `200` | Hard ceiling on steps persisted per session |

## Redaction

Secrets are scrubbed from step input/output before persistence. Default patterns catch `sk-...` (OpenAI keys), `Bearer ...` (auth tokens), `password=...`, and `api_key=...`. Redacted spans become `[REDACTED]`.

## ESM + CJS

Both are supported. The `exports` field routes automatically:

```javascript
// ESM
import { trace } from "@smazzinni/sdk";

// CJS
const { trace } = require("@smazzinni/sdk");
```

## License

MIT — see [LICENSE](./LICENSE).
