"""Per-model cost estimation.

Rates are expressed per **1,000,000 tokens** in USD, matching the API
endpoint's own estimator. Models not in the rate table fall back to the
``FALLBACK_RATE`` (GPT-4o pricing) — the same behaviour as the API's own
estimator and the TypeScript SDK. Steps without a model also use the
fallback rate; steps without tokens contribute zero.

**Auto-update:** If the ``REPLAYAI_COST_RATES_URL`` environment variable is
set, the rate table is fetched from that URL on first use (cached for the
process lifetime). The URL must return JSON in the same format as
``DEFAULT_RATES`` (a dict of model name → ``{"in": float, "out": float}``).
If the fetch fails, the built-in ``DEFAULT_RATES`` are used as a fallback.
"""
from __future__ import annotations

import json
import os
import threading
import urllib.request
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


# ---------------------------------------------------------------------------
# Rate-table loading with optional URL override.
# ---------------------------------------------------------------------------
_rates_cache: Optional[dict] = None
_rates_lock = threading.Lock()


def _load_rates_from_url() -> Optional[dict]:
    """Fetch rates from ``REPLAYAI_COST_RATES_URL`` if set.

    Returns a dict on success, or ``None`` on failure (env unset, network
    error, or invalid JSON). Errors are silently swallowed — the caller
    falls back to ``DEFAULT_RATES``.
    """
    url = os.environ.get("REPLAYAI_COST_RATES_URL")
    if not url:
        return None
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        # Validate shape: must be a dict of model → {in, out}.
        if not isinstance(data, dict):
            return None
        validated: dict = {}
        for model, rates in data.items():
            if not isinstance(rates, dict):
                continue
            if "in" not in rates or "out" not in rates:
                continue
            validated[model] = {
                "in": float(rates["in"]),
                "out": float(rates["out"]),
            }
        return validated if validated else None
    except Exception:
        return None


def get_rates() -> dict:
    """Return the active rate table.

    On first call, if ``REPLAYAI_COST_RATES_URL`` is set, rates are fetched
    from that URL and cached for the process lifetime. On failure, the
    built-in ``DEFAULT_RATES`` are used. Thread-safe.
    """
    global _rates_cache
    with _rates_lock:
        if _rates_cache is not None:
            return _rates_cache
        fetched = _load_rates_from_url()
        _rates_cache = fetched if fetched is not None else dict(DEFAULT_RATES)
        return _rates_cache


def _reset_rates_cache() -> None:
    """Clear the rate-table cache. Useful for tests."""
    global _rates_cache
    with _rates_lock:
        _rates_cache = None


def estimate_cost(
    steps: Iterable[Mapping[str, object]],
    *,
    rates: Optional[Mapping[str, Mapping[str, float]]] = None,
) -> float:
    """Estimate total USD cost for an iterable of step dicts.

    Each step may carry ``model`` (str), ``tokens_in`` (int), ``tokens_out``
    (int). Steps without a model use the fallback rate; steps without
    tokens contribute zero.

    When ``rates`` is not supplied, the active rate table is resolved via
    :func:`get_rates` (which honors ``REPLAYAI_COST_RATES_URL``).
    """
    rate_table = rates if rates is not None else get_rates()
    # Resolve the fallback from the active table (or DEFAULT_RATES if the
    # custom table doesn't include "gpt-4o").
    fallback = rate_table.get("gpt-4o", FALLBACK_RATE)
    total = 0.0
    for step in steps:
        model = step.get("model") or step.get("model_name")
        tokens_in = int(step.get("tokens_in") or step.get("tokensIn") or 0)
        tokens_out = int(step.get("tokens_out") or step.get("tokensOut") or 0)
        rate = rate_table.get(model, fallback) if model else fallback
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
