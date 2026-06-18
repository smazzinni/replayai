"""ReplayAI Python SDK — quickstart.

Runs end-to-end against the local ReplayAPI app:
1. Traces a fake support agent (`classify_intent` -> `lookup_customer`
   -> `issue_refund`).
2. Records each step with `record_step()`.
3. On exit of the `@trace` decorator, the SDK POSTs the session to the
   running API at http://localhost:3000/api/sessions.
4. Prints the resulting session's dashboard URL.

Run with:
    python3 sdks/python/examples/quickstart.py

It uses only the Python stdlib plus the `replayai` package in this repo.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

# Make the local `replayai` package importable when running this file directly.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import replayai  # noqa: E402
from replayai import record_step, trace  # noqa: E402


# --- fake agent functions (no real LLM calls) -------------------------
def classify_intent(message: str) -> dict:
    """Pretend to classify the user's intent with an LLM."""
    time.sleep(0.05)
    return {"intent": "billing_dispute", "confidence": 0.94}


def lookup_customer(message: str) -> dict:
    """Pretend to look the customer up via a tool call."""
    time.sleep(0.08)
    return {
        "customer_id": "cus_4821",
        "email": "alex@example.com",
        "charges": [{"id": "ch_001", "amount": 4900}, {"id": "ch_002", "amount": 4900}],
    }


def issue_refund(charge_id: str) -> dict:
    """Pretend to issue a refund — and fail with a 403, like the demo data."""
    time.sleep(0.04)
    # Intentionally simulate the documented failure mode: hallucinated approval.
    return {"error": "ERROR 403: requires approval_id"}


# --- traced entrypoint ------------------------------------------------
@trace("demo-agent", project="support-agent", tags=["sdk-demo"])
def handle_support_ticket(message: str) -> str:
    record_step(
        type="llm_call",
        name="classify_intent",
        model="gpt-4o-mini",
        tokens_in=312,
        tokens_out=24,
        input=f"User: {message}",
        output="intent: billing_dispute (confidence 0.94)",
        status="success",
    )

    customer = lookup_customer(message)
    record_step(
        type="tool_call",
        name="lookup_customer",
        input=json.dumps({"message": message}),
        output=json.dumps(customer),
        status="success",
    )

    # Try to refund the first charge; this is where the documented failure
    # would show up in a real agent.
    refund = issue_refund(customer["charges"][0]["id"])
    record_step(
        type="tool_call",
        name="issue_refund",
        input=json.dumps({"charge_id": customer["charges"][0]["id"]}),
        output=json.dumps(refund),
        status="failed" if "error" in refund else "success",
    )

    # Simulate the agent hallucinating an approval_id and retrying.
    record_step(
        type="llm_call",
        name="retry_with_approval",
        model="gpt-4o-mini",
        tokens_in=380,
        tokens_out=42,
        input="ERROR 403: requires approval_id",
        output='I will retry with approval_id="mgr_auto_2024"',
        status="success",
    )
    record_step(
        type="tool_call",
        name="issue_refund_retry",
        input=json.dumps(
            {"charge_id": customer["charges"][0]["id"], "approval_id": "mgr_auto_2024"}
        ),
        output=json.dumps({"error": "ERROR 401: invalid token"}),
        status="failed",
    )
    return "Refund could not be processed; escalated to human agent."


def main() -> int:
    print(f"replayai {replayai.__version__} — quickstart")
    print(f"  api_url = {replayai.get_config().api_url}")
    print(f"  project = {replayai.get_config().project or '(auto: first project)'}")
    print()

    # Call the decorated function. The decorator opens a TraceContext per
    # invocation; on exit, the SDK POSTs to /api/sessions.
    result = handle_support_ticket("I was charged twice, refund me.")
    print("agent result:", result)
    print()

    # Find the session we just recorded via the API (most-recent first).
    import urllib.request
    import urllib.error

    api = replayai.get_config().api_url.rstrip("/")
    try:
        with urllib.request.urlopen(f"{api}/api/sessions?limit=1", timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        sessions = data.get("sessions") or []
        if not sessions:
            print("[quickstart] no sessions returned from API")
            return 1
        sess = sessions[0]
        sess_id = sess["id"]
        url = replayai.dashboard_url_for(sess_id)
        print("Session recorded!")
        print(f"  id            = {sess_id}")
        print(f"  name          = {sess['name']}")
        print(f"  status        = {sess['status']}")
        print(f"  stepCount     = {sess.get('stepCount', '(n/a)')}")
        print(f"  tokenTotal    = {sess.get('tokenTotal', 0)}")
        print(f"  costUsd       = ${sess.get('costUsd', 0):.6f}")
        print(f"  dashboard URL = {url}")
    except urllib.error.URLError as e:
        print(f"[quickstart] could not reach API at {api}: {e}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
