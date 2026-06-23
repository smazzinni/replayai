# `replayai` — Python SDK

[![PyPI version](https://img.shields.io/pypi/v/replayai-sdk?color=blue)](https://pypi.org/project/replayai-sdk/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

Instrument Python agents, record every step (LLM calls, tool calls, retrievals, errors),
and view sessions in the built-in dashboard where you can replay them, diff runs, and
export tests.

- **Stdlib only** — `pip install replayai-sdk` brings no dependencies.
- **Built-in dashboard** — `replayai ui` launches a self-contained dashboard server. No external app or database required.
- **Decorator + context manager** — `@trace(...)` or `with trace(...) as ctx:`.
- **Framework extras** — `pip install "replayai-sdk[langchain]"` for auto-instrumentation.

## Install

```bash
pip install replayai-sdk
# or, with the LangChain integration:
pip install "replayai-sdk[langchain]"
```

> **Windows note:** If you see a warning like *"The script replayai.exe is installed in … which is not on PATH"*, either add that directory to your PATH or use `python -m replayai` instead — it works identically:
>
> ```bash
> python -m replayai ui          # same as: replayai ui
> python -m replayai record agent.py
> ```

## 30-second usage

```python
from replayai import trace, record_step

@trace("support-agent-v3", project="support-agent", tags=["production"])
def handle_support_ticket(message: str) -> str:
    record_step(
        type="llm_call", name="classify_intent",
        model="gpt-4o-mini", tokens_in=312, tokens_out=24,
        input=f"User: {message}", output="intent: billing_dispute",
        status="success",
    )
    record_step(
        type="tool_call", name="issue_refund",
        input='{"charge_id":"ch_002"}',
        output='{"refund_id":"ref_3391"}',
        status="success",
    )
    return "Refund issued (ref_3391)."

handle_support_ticket("I was charged twice, refund me.")
```

## Launching the dashboard

The SDK ships with a self-contained dashboard server that mirrors the ReplayAI website's Live Demo design. Record sessions locally, then launch the UI to view them:

```bash
# 1. Record a session (stored locally in ./ReplayAI/sessions/ by default)
replayai record my_agent.py --name "my-agent" --tags "prod"

# 2. Launch the dashboard
replayai ui
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
replayai record <script.py> [--project <slug>] [--tags a,b]   # Run a script under a trace
replayai test [tests/replay/] [--live-llm]                    # Run replay regression tests
replayai ui [--port 7373] [--storage ./replays]               # Launch the dashboard
replayai --version                                            # Print version
```

## Configuration

Environment variables (all optional):

| Variable | Default | Description |
| --- | --- | --- |
| `REPLAYAI_PROJECT` | — | Default project slug/id |
| `REPLAYAI_TOKEN` | — | Cloud API token |
| `REPLAYAI_STORAGE` | `cloud` | `cloud`, `local`, or `both` |
| `REPLAYAI_STORAGE_PATH` | `./ReplayAI` | Local storage directory (used when `storage` includes `local`) |
| `REPLAYAI_API_URL` | `http://localhost:3000` | Cloud API base URL |
| `REPLAYAI_DASHBOARD_URL` | `http://localhost:3000` | Dashboard base URL |
| `REPLAYAI_SAMPLE_RATE` | `1.0` | Fraction of sessions to record |
| `REPLAYAI_STRICT` | `false` | Raise on recording failures |
| `REPLAYAI_REDACT_PATTERNS` | built-in set | Comma-separated regexes |
| `REPLAYAI_REDACT_STRICT` | `true` | Set `false` to disable entropy-based secret detection |
| `REPLAYAI_TIMEOUT` | `30` | Per-request HTTP timeout (seconds) |
| `REPLAYAI_MAX_STEPS` | `200` | Hard ceiling on steps persisted per session |
| `REPLAYAI_COST_RATES_URL` | — | URL to fetch current model pricing (JSON: `{"model": {"in": float, "out": float}}`). Falls back to built-in rates on failure. |

Programmatic override:

```python
import replayai
replayai.configure(project="support-agent", api_url="http://localhost:3000")
replayai.set_strict_mode(True)  # opt into hard failures (was: replayai.strict_mode = True)
```

## Storage modes

The SDK supports three storage modes via `REPLAYAI_STORAGE` (or `configure(storage=...)`):

| Mode | Behavior | Use case |
| --- | --- | --- |
| `cloud` (default) | POSTs sessions to the ReplayAI API at `REPLAYAI_API_URL`. | Production, shared dashboards, team collaboration. |
| `local` | Saves sessions as JSON files to `./ReplayAI/sessions/`. No network calls. | Offline development, CI, local debugging with `replayai ui`. |
| `both` | Saves locally AND POSTs to the API. | Hybrid: local backup + cloud visibility. |

**Offline mode (no API needed):**

```bash
# Record locally (no API running)
REPLAYAI_STORAGE=local replayai record my_agent.py

# View in the dashboard
replayai ui
```

Session files are saved to `./ReplayAI/sessions/*.json` with mode `0600` (owner read/write only) for security. The dashboard server reads from this directory automatically.

## Comparing sessions

`ReplaySession.compare()` runs a live callable under a trace and diffs it against the recorded session. It uses **LCS (Longest Common Subsequence) alignment** by step name+type, so an inserted or removed step doesn't cascade into false divergences for every subsequent step.

```python
from replayai import ReplaySession

replay = ReplaySession("ses_8fa1")
replay.mock("issue_refund", '{"refund_id":"ref_3391"}')

result = replay.compare(
    agent_callable=lambda msg: my_agent.run(msg),
    inputs="I was charged twice",
)

print(result["matches"])           # True if no divergences
print(result["step_count_loaded"]) # recorded step count
print(result["step_count_live"])   # live step count
for d in result["divergences"]:
    print(f"  step {d['step']}: {d['field']} (loaded={d['loaded']!r}, live={d['live']!r})")
```

Divergence `field` values: `"output"`, `"status"`, `"model"` (aligned steps that differ), `"added"` (live step not in recording), `"removed"` (recorded step not in live run).

## Async

```python
import asyncio
from replayai import atrace, arecord_step

@atrace("async-agent")
async def handle(message: str) -> str:
    await arecord_step(type="llm_call", name="classify", status="success")
    return "ok"

asyncio.run(handle("hello"))
```

## Replay & export

```python
from replayai import ReplaySession

replay = ReplaySession("ses_8fa1")
replay.mock("issue_refund", '{"refund_id":"ref_3391"}')
with replay.trace() as trace_obj:
    replay.run(agent="support-agent-v3", framework="LangChain")
print(trace_obj.step_count, trace_obj.status)
print(replay.export(lang="pytest"))
```

## LangChain integration

```python
from replayai.integrations.langchain import trace_agent, ReplayCallbackHandler

@trace_agent("support-agent-v3", project="support-agent", tags=["production"])
def handle(message: str) -> str:
    return executor.invoke({"input": message})["output"]
```

See `examples/quickstart.py` and `examples/langchain_demo.py` for runnable demos.

## Windows

The SDK works on Windows. A few notes:

**PATH warning:** If you see `The script replayai.exe is installed in ... which is not on PATH`, use `python -m replayai` instead — it works identically:

```powershell
python -m replayai ui
python -m replayai record my_agent.py
```

**PowerShell env vars:**

```powershell
# Set env vars for the current session
$env:REPLAYAI_STORAGE = "local"
$env:REPLAYAI_STORAGE_PATH = ".\ReplayAI"

# Record + launch
python -m replayai record my_agent.py
python -m replayai ui
```

**File permissions:** Session files are created with restrictive permissions. On Windows, `chmod` is a no-op — files inherit the user's default ACL (typically single-user). The `0600`/`0700` modes are enforced on POSIX systems.

**Firewall:** The dashboard server listens on `0.0.0.0:7373`. If Windows Firewall prompts, allow access for local development. To listen on localhost only, set `--port` and access via `http://localhost:7373`.

## License

MIT — see [LICENSE](./LICENSE).
