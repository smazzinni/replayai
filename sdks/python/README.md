# `replayai` — Python SDK

Instrument Python agents, record every step (LLM calls, tool calls, retrievals, errors),
and POST sessions to the ReplayAI dashboard where you can replay them, diff runs, and
export tests.

- **Stdlib only** — `pip install replayai-sdk` brings no dependencies.
- **Decorator + context manager** — `@trace(...)` or `with trace(...) as ctx:`.
- **Framework extras** — `pip install "replayai-sdk[langchain]"` for auto-instrumentation.

## Install

```bash
pip install replayai-sdk
# or, with the LangChain integration:
pip install "replayai-sdk[langchain]"
```

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

Open the dashboard — your run is there with a full timeline.

## Configuration

Environment variables (all optional):

| Variable | Default | Description |
| --- | --- | --- |
| `REPLAYAI_PROJECT` | — | Default project slug/id |
| `REPLAYAI_TOKEN` | — | Cloud API token |
| `REPLAYAI_STORAGE` | `cloud` | `cloud`, `local`, or `both` |
| `REPLAYAI_API_URL` | `http://localhost:3000` | Cloud API base URL |
| `REPLAYAI_SAMPLE_RATE` | `1.0` | Fraction of sessions to record |
| `REPLAYAI_STRICT` | `false` | Raise on recording failures |
| `REPLAYAI_REDACT_PATTERNS` | built-in set | Comma-separated regexes |

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

MIT.
