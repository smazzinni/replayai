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

The SDK ships with a self-contained dashboard server that mirrors the ReplayAI website's Live Demo design. Record sessions locally, then launch the UI:

```bash
# 1. Record a session (stored locally in ./ReplayAI/sessions/)
#    Your code calls withTrace() + recordStep() with storage: "local".

# 2. Launch the dashboard
npx replayai ui
# → opens http://localhost:7373 in your browser
# → shows all locally-recorded sessions with full step timelines
```

The dashboard features:
- **6 stat cards** (Sessions, Failed, Steps, Cost, Fail Rate, Avg Run)
- **Sessions sidebar** with status dots, duration, cost, step count, relative time
- **Replay timeline** with a clickable scrubber bar + step controls (restart, prev, next, last)
- **Step detail** with type badge, model, duration, tokens, offset, and input/output fields
- **Auto-refresh** every 5 seconds (new sessions appear instantly)
- **Window chrome** with traffic lights + breadcrumbs (matches the website design)

Options:

| Flag | Default | Description |
| --- | --- | --- |
| `--port` | `7373` | Port to listen on |
| `--storage` | `./ReplayAI` | Local storage path (sessions saved to `{storage}/sessions/`) |
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

Load a recorded session and either re-run it, compare a live run against it, or export it as a test.

```typescript
import { ReplaySession } from "@smazzinni/sdk";

const replay = new ReplaySession("ses_8fa1", { liveLlm: false });

replay.mock("issue_refund", JSON.stringify({ refund_id: "ref_3391" }));

const trace = await replay.load();
console.log(trace.stepCount, trace.status);

const code = await replay.export("pytest"); // or "jest"
```

### `compare()` — diff a live run against the recording

`compare()` runs a live callable under a trace and diffs it against the loaded session. It uses **LCS (Longest Common Subsequence) alignment** by step name+type, so an inserted or removed step doesn't cascade into false divergences for every subsequent step.

```typescript
import { ReplaySession } from "@smazzinni/sdk";

const replay = new ReplaySession("ses_8fa1");
replay.mock("issue_refund", JSON.stringify({ refund_id: "ref_3391" }));

const result = await replay.compare(
  (msg: string) => myAgent.run(msg),
  "I was charged twice",
);

console.log(result.matches);           // true if no divergences
console.log(result.stepCountLoaded);   // recorded step count
console.log(result.stepCountLive);     // live step count
for (const d of result.divergences) {
  console.log(`  step ${d.step}: ${d.field} (loaded=${d.loaded}, live=${d.live})`);
}
```

Divergence `field` values: `"output"`, `"status"`, `"model"` (aligned steps that differ), `"added"` (live step not in recording), `"removed"` (recorded step not in live run).

### `configure(opts)`

Programmatic configuration. Same keys as the env vars below.

```typescript
configure({
  project: "support-agent",
  storage: "both",
  storagePath: "./ReplayAI",
  token: process.env.REPLAYAI_TOKEN!,
  apiUrl: "https://api.replayai.dev",
  sampleRate: 1.0,
  redactPatterns: [/sk-[a-zA-Z0-9]{20,}/],
});
```

### `getStrictMode()` / `setStrictMode()`

```typescript
import { getStrictMode, setStrictMode } from "@smazzinni/sdk";

setStrictMode(true);  // opt into hard failures
console.log(getStrictMode()); // true
```

### `VERSION`

```typescript
import { VERSION } from "@smazzinni/sdk";
console.log(VERSION); // "0.7.2"
```

## Storage modes

The SDK supports three storage modes via `REPLAYAI_STORAGE` (or `configure({ storage })`):

| Mode | Behavior | Use case |
| --- | --- | --- |
| `cloud` (default) | POSTs sessions to the ReplayAI API at `REPLAYAI_API_URL`. | Production, shared dashboards, team collaboration. |
| `local` | Saves sessions as JSON files to `./ReplayAI/sessions/`. No network calls. | Offline development, CI, local debugging with `replayai ui`. |
| `both` | Saves locally AND POSTs to the API. | Hybrid: local backup + cloud visibility. |

**Offline mode (no API needed):**

```bash
# Set storage mode + record
REPLAYAI_STORAGE=local node my_agent.js

# View in the dashboard
npx replayai ui
```

Session files are saved to `./ReplayAI/sessions/*.json` with mode `0600` (owner read/write only) for security. The dashboard server reads from this directory automatically.

## Environment variables

| Variable | Default | Description |
| --- | --- | --- |
| `REPLAYAI_PROJECT` | — | Default project slug/id when `trace()` omits it |
| `REPLAYAI_TOKEN` | — | Cloud API token (sent as `Authorization: Bearer`) |
| `REPLAYAI_STORAGE` | `cloud` | `local`, `cloud`, or `both` |
| `REPLAYAI_STORAGE_PATH` | `./ReplayAI` | Local storage directory |
| `REPLAYAI_API_URL` | `http://localhost:3000` | Cloud API base URL |
| `REPLAYAI_DASHBOARD_URL` | `http://localhost:3000` | Where session URLs point |
| `REPLAYAI_REDACT_PATTERNS` | built-in set | Comma-separated regex patterns to redact |
| `REPLAYAI_REDACT_STRICT` | `true` | Set `false` to disable entropy-based secret detection |
| `REPLAYAI_SAMPLE_RATE` | `1.0` | Fraction of sessions to record (0.0–1.0) |
| `REPLAYAI_STRICT` | `false` | Raise on recording failures instead of warning |
| `REPLAYAI_TIMEOUT` | `30000` | Per-request HTTP timeout (ms) |
| `REPLAYAI_MAX_STEPS` | `200` | Hard ceiling on steps persisted per session |
| `REPLAYAI_COST_RATES_URL` | — | URL to fetch current model pricing (JSON: `{"model": {"in": number, "out": number}}`). Falls back to built-in rates on failure. |

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

## Windows

The SDK works on Windows. A few notes:

**npx works everywhere:** `npx replayai ui` works without any PATH configuration.

**PowerShell env vars:**

```powershell
# Set env vars for the current session
$env:REPLAYAI_STORAGE = "local"
$env:REPLAYAI_STORAGE_PATH = ".\ReplayAI"

# Record + launch
node my_agent.js
npx replayai ui
```

**File permissions:** Session files are created with restrictive permissions. On Windows, `chmod` is a no-op — files inherit the user's default ACL (typically single-user). The `0600`/`0700` modes are enforced on POSIX systems.

**Firewall:** The dashboard server listens on `0.0.0.0:7373`. If Windows Firewall prompts, allow access for local development. To listen on localhost only, set `--port` and access via `http://localhost:7373`.

## License

MIT — see [LICENSE](./LICENSE).
