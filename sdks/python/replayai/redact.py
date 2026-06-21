"""Redaction of secrets from step input/output before persistence.

Default patterns come from :mod:`replayai.config`. Redacted spans are
replaced with a stable, value-derived marker::

    [REDACTED:<sha256[:8]>]

so the same secret value always produces the same marker (useful for
correlating redacted spans across steps without re-leaking the value).

In addition to regex patterns, an entropy-based detector flags long
high-entropy tokens (likely API keys, JWTs, opaque IDs) that don't match
any whitelist pattern (UUIDs, ISO timestamps, URLs, snake_case
identifiers). Entropy detection can be disabled by setting the
``REDACT_STRICT=false`` environment variable.
"""
from __future__ import annotations

import hashlib
import math
import os
import re
from collections import Counter
from typing import Any, Optional

from .config import get_config


# ---------------------------------------------------------------------------
# Whitelist patterns — tokens matching any of these are never entropy-redacted.
# ---------------------------------------------------------------------------
_UUID_RE = re.compile(
    r"\A[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\Z"
)
_ISO_TS_RE = re.compile(
    r"\A\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+\-]\d{2}:?\d{2})?)?\Z"
)
_URL_RE = re.compile(r"\A(?:https?|ftp|wss?)://[^\s]+\Z")
# snake_case identifier: lowercase letters/digits with at least one underscore,
# no uppercase (which would suggest a hash or encoded value).
_SNAKE_RE = re.compile(r"\A[a-z][a-z0-9]*(?:_[a-z0-9]+)+\Z")

# Token candidate pattern for entropy detection. Matches long runs of
# characters that commonly appear in opaque tokens: base62 + base64-ish +
# dash/slash/plus/equals (JWT separators, base64 padding).
_ENTROPY_TOKEN_RE = re.compile(r"[A-Za-z0-9_\-/+=]{20,}")

_ENTROPY_THRESHOLD: float = 4.5
_ENTROPY_MIN_LEN: int = 20


def _shannon_entropy(s: str) -> float:
    """Shannon entropy in bits per symbol for ``s``."""
    if not s:
        return 0.0
    counts = Counter(s)
    length = len(s)
    return -sum((c / length) * math.log2(c / length) for c in counts.values())


def _is_whitelisted(token: str) -> bool:
    """Return True if ``token`` matches any whitelist pattern."""
    if not token:
        return True
    if _UUID_RE.match(token):
        return True
    if _ISO_TS_RE.match(token):
        return True
    if _URL_RE.match(token):
        return True
    if _SNAKE_RE.match(token):
        return True
    return False


def _redaction_marker(secret_value: str) -> str:
    """Build ``[REDACTED:<sha256[:8]>]`` — stable per secret value."""
    digest = hashlib.sha256(secret_value.encode("utf-8")).hexdigest()[:8]
    return f"[REDACTED:{digest}]"


def _entropy_enabled() -> bool:
    """Return True if entropy-based detection is enabled (default).

    Disabled only when ``REDACT_STRICT`` is explicitly one of the
    false-y values (``false``, ``0``, ``no``, ``off``).
    """
    raw = os.environ.get("REDACT_STRICT")
    if raw is None or raw.strip() == "":
        return True
    return raw.strip().lower() not in {"false", "0", "no", "off"}


def _redact_entropy(text: str) -> str:
    """Redact long, high-entropy, non-whitelisted tokens in ``text``."""

    def replace(match: re.Match) -> str:
        token = match.group(0)
        if _is_whitelisted(token):
            return token
        if len(token) <= _ENTROPY_MIN_LEN:
            return token
        try:
            ent = _shannon_entropy(token)
        except Exception:  # noqa: BLE001
            return token
        if ent > _ENTROPY_THRESHOLD:
            return _redaction_marker(token)
        return token

    return _ENTROPY_TOKEN_RE.sub(replace, text)


def redact_text(value: Any) -> str:
    """Redact secrets from a value, returning a string.

    Non-string inputs are first coerced via :func:`_stringify` so
    dict/list inputs are still scanned. The configured regex patterns
    are applied in order; each match is replaced with a stable
    ``[REDACTED:<sha256[:8]>]`` marker. If entropy detection is enabled
    (default), long high-entropy tokens that are not whitelisted are
    also redacted.
    """
    if value is None:
        return ""
    if not isinstance(value, str):
        try:
            text = _stringify(value)
        except Exception:  # noqa: BLE001
            text = repr(value)
    else:
        text = value

    cfg = get_config()
    for pattern in cfg.compiled_redact_patterns:
        try:
            text = pattern.sub(lambda m: _redaction_marker(m.group(0)), text)
        except re.error:
            # Malformed user-supplied patterns shouldn't crash the agent.
            continue

    if _entropy_enabled():
        try:
            text = _redact_entropy(text)
        except Exception:  # noqa: BLE001
            # Never let redaction itself crash the recording path.
            pass

    return text


def _stringify(value: Any) -> str:
    """Coerce a value to a string, preferring JSON for collections."""
    import json

    if isinstance(value, (dict, list, tuple, set)):
        try:
            return json.dumps(value, default=str, ensure_ascii=False)
        except Exception:  # noqa: BLE001
            return str(value)
    return str(value)


def redact_optional(value: Optional[str]) -> Optional[str]:
    """Redact an optional string. ``None`` passes through unchanged."""
    if value is None:
        return None
    return redact_text(value)
