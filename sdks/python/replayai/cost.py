"""Per-model cost estimation.

Rates are expressed per **1,000,000 tokens** in USD, matching the API
endpoint's own estimator. Models unknown to the SDK estimate to zero
(with a debug log) — callers can override cost explicitly when posting.
"""
from __future__ import annotations

from typing import Iterable, Mapping, Optional

# Per 1M tokens, USD. Keep in sync with src/app/api/sessions/route.ts.
DEFAULT_RATES: Mapping[str, Mapping[str, float]] = {
    "gpt-4o": {"in": 2.5, "out": 10.0},
    "gpt-4o-mini": {"in": 0.15, "out": 0.6},
    "gpt-4-turbo": {"in": 10.0, "out": 30.0},
    "gpt-3.5-turbo": {"in": 0.5, "out": 1.5},
    "claude-3.5-sonnet": {"in": 3.0, "out": 15.0},
    "claude-3-5-haiku": {"in": 0.8, "out": 4.0},
    "claude-3-opus": {"in": 15.0, "out": 75.0},
    "gemini-1.5-pro": {"in": 1.25, "out": 5.0},
    "gemini-1.5-flash": {"in": 0.075, "out": 0.3},
    "llama-3.1-70b": {"in": 0.59, "out": 0.79},
}

# Fallback rate used when a model name is supplied but isn't in the table.
# Defaults to GPT-4o's pricing — same as the API's own estimator.
FALLBACK_RATE: Mapping[str, float] = DEFAULT_RATES["gpt-4o"]


def estimate_cost(
    steps: Iterable[Mapping[str, object]],
    *,
    rates: Optional[Mapping[str, Mapping[str, float]]] = None,
) -> float:
    """Estimate total USD cost for an iterable of step dicts.

    Each step may carry ``model`` (str), ``tokens_in`` (int), ``tokens_out``
    (int). Steps without a model use the fallback rate; steps without
    tokens contribute zero.
    """
    rate_table = rates if rates is not None else DEFAULT_RATES
    total = 0.0
    for step in steps:
        model = step.get("model") or step.get("model_name")
        tokens_in = int(step.get("tokens_in") or step.get("tokensIn") or 0)
        tokens_out = int(step.get("tokens_out") or step.get("tokensOut") or 0)
        rate = rate_table.get(model, FALLBACK_RATE) if model else FALLBACK_RATE
        total += (tokens_in / 1_000_000) * rate["in"]
        total += (tokens_out / 1_000_000) * rate["out"]
    return round(total, 6)


def estimate_step_cost(
    model: Optional[str],
    tokens_in: int = 0,
    tokens_out: int = 0,
) -> float:
    """Estimate cost for a single step. Convenience wrapper."""
    return estimate_cost(
        [{"model": model, "tokens_in": tokens_in, "tokens_out": tokens_out}]
    )
