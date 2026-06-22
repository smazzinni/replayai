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

The SDK ships with a self-contained dashboard server. Record sessions locally, then launch the UI to view them:

```bash
# 1. Record a session (stored locally by default when REPLAYAI_STORAGE=local)
REPLAYAI_STORAGE=local replayai record my_agent.py

# 2. Launch the dashboard
replayai ui
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
| `REPLAYAI_STORAGE_PATH` | `./replays` | Local storage directory (used when `storage` includes `local`) |
| `REPLAYAI_API_URL` | `http://localhost:3000` | Cloud API base URL |
| `REPLAYAI_DASHBOARD_URL` | `http://localhost:3000` | Dashboard base URL |
| `REPLAYAI_SAMPLE_RATE` | `1.0` | Fraction of sessions to record |
| `REPLAYAI_STRICT` | `false` | Raise on recording failures |
| `REPLAYAI_REDACT_PATTERNS` | built-in set | Comma-separated regexes |
| `REPLAYAI_REDACT_STRICT` | `true` | Set `false` to disable entropy-based secret detection |
| `REPLAYAI_TIMEOUT` | `30` | Per-request HTTP timeout (seconds) |
| `REPLAYAI_MAX_STEPS` | `200` | Hard ceiling on steps persisted per session |

Programmatic override:

```python
import replayai
replayai.configure(project="support-agent", api_url="http://localhost:3000")
replayai.strict_mode = True  # opt into hard failures
```

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

## License

MIT — see [LICENSE](./LICENSE).
