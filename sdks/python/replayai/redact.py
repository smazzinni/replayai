"""Redaction of secrets from step input/output before persistence.

Default patterns come from :mod:`replayai.config`. Redacted spans are
replaced with the literal ``[REDACTED]``.
"""
from __future__ import annotations

from typing import Any, Optional

from .config import get_config


REDACTED = "[REDACTED]"


def redact_text(value: Any) -> str:
    """Redact secrets from a value, returning a string.

    Non-string inputs are first coerced via ``str()`` so dict/list inputs
    are still scanned. The configured regex patterns are applied in order;
    each match is replaced with ``[REDACTED]``.
    """
    if value is None:
        return ""
    if not isinstance(value, str):
        # Best-effort: redact common secret-bearing structures.
        try:
            text = _stringify(value)
        except Exception:
            text = repr(value)
    else:
        text = value

    cfg = get_config()
    for pattern in cfg.compiled_redact_patterns:
        try:
            text = pattern.sub(REDACTED, text)
        except re_error():
            # Malformed user-supplied patterns shouldn't crash the agent.
            continue
    return text


def _stringify(value: Any) -> str:
    """Coerce a value to a string, preferring JSON for collections."""
    import json

    if isinstance(value, (dict, list, tuple, set)):
        try:
            return json.dumps(value, default=str, ensure_ascii=False)
        except Exception:
            return str(value)
    return str(value)


def re_error():
    """Return ``re.error`` lazily — kept as a function so import order is fine."""
    import re

    return re.error


def redact_optional(value: Optional[str]) -> Optional[str]:
    """Redact an optional string. ``None`` passes through unchanged."""
    if value is None:
        return None
    return redact_text(value)
