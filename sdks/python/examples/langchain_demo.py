"""ReplayAI LangChain integration demo.

Demonstrates the three LangChain integration surfaces:

1. `@trace_chain(...)` wrapping a chain invocation.
2. `@trace_agent(...)` wrapping an agent executor invocation.
3. `ReplayCallbackHandler` attached to a runnable's `callbacks=`.

If `langchain-core` is not installed, the demo prints a friendly notice
and exits 0 — it never crashes the user's environment.

Run with:
    python3 sdks/python/examples/langchain_demo.py

To install langchain for the full demo:
    pip install "replayai[langchain]" langchain-openai
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import replayai  # noqa: E402
from replayai import record_step  # noqa: E402
from replayai.integrations.langchain import (  # noqa: E402
    ReplayCallbackHandler,
    trace_agent,
    trace_chain,
)


def _langchain_available() -> bool:
    try:
        import langchain_core  # type: ignore  # noqa: F401

        return True
    except ImportError:
        return False


# ----- always-on: the decorators work even without langchain installed -----
@trace_chain("docs-qa", project="docs-qa", tags=["rag"])
def answer(question: str) -> str:
    """A stub 'chain' that records steps manually if langchain isn't around."""
    record_step(
        type="retrieval",
        name="vector_search",
        input=question,
        output="[0] Employees may carry over up to 5 PTO days...\n[1] Carryover days expire Mar 31.",
        status="success",
    )
    record_step(
        type="llm_call",
        name="generate_answer",
        model="gpt-4o-mini",
        tokens_in=512,
        tokens_out=64,
        input=question,
        output="Up to 5 PTO days carry over; they must be used by March 31.",
        status="success",
    )
    return "Up to 5 PTO days carry over; they must be used by March 31."


@trace_agent("support-agent-v3", project="support-agent", tags=["production"])
def handle_support_ticket(message: str) -> str:
    """Stub agent: records the same shape of steps a real agent would."""
    record_step(
        type="llm_call",
        name="classify_intent",
        model="gpt-4o-mini",
        tokens_in=312,
        tokens_out=24,
        input=f"User: {message}",
        output="intent: billing_dispute",
        status="success",
    )
    record_step(
        type="tool_call",
        name="lookup_customer",
        input='{"message":"refund please"}',
        output='{"customer_id":"cus_4821","charges":[{"id":"ch_002","amount":4900}]}',
        status="success",
    )
    record_step(
        type="tool_call",
        name="issue_refund",
        input='{"charge_id":"ch_002"}',
        output="ERROR 403: requires approval_id",
        status="failed",
    )
    return "Refund escalated."


def main() -> int:
    print(f"replayai {replayai.__version__} — LangChain demo")
    print(f"  langchain installed: {_langchain_available()}")
    print(f"  api_url = {replayai.get_config().api_url}")
    print()

    # 1) The decorator-wrapped functions always work — they record via the
    #    ambient trace and flush on exit.
    print("Q: How many PTO days carry over?")
    print(f"A: {answer('How many PTO days carry over?')}")
    print()

    print("Q: I was charged twice, refund me.")
    print(f"A: {handle_support_ticket('I was charged twice, refund me.')}")
    print()

    # 2) ReplayCallbackHandler: only exercisable with langchain installed.
    if not _langchain_available():
        print(
            "ReplayCallbackHandler not exercised — langchain-core is not installed.\n"
            'Install with: pip install "replayai[langchain]"'
        )
        return 0

    # Constructing the handler should succeed now.
    handler = ReplayCallbackHandler(
        name="callback-handler-demo", project="docs-qa", tags=["callbacks"]
    )
    print(f"ReplayCallbackHandler constructed: {handler}")
    print(
        "(attach via `Runnable.invoke(..., config={'callbacks': [handler]})` "
        "or `AgentExecutor(..., callbacks=[handler])`)"
    )
    # Flush any trace the handler opened.
    handler.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
