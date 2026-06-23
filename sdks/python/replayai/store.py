"""HTTP store — POSTs recorded sessions to the ReplayAI API.

Uses only :mod:`urllib` so the core package remains stdlib-only. All
network/HTTP/JSON failures surface as :class:`StoreError` from
``_do_request``. ``flush_session()`` is the only public entry point that
swallows ``StoreError`` (in non-strict mode) for backward compatibility.

v0.6.0 additions:
- Retry with exponential backoff (3 attempts, base 1s, max 10s, ±25% jitter)
  on HTTP 5xx / 429 and network errors.
- Configurable timeout via ``Config.timeout`` / ``REPLAYAI_TIMEOUT`` (30s
  default — previously hard-coded to 15s).
- Payload size guard: sessions larger than 5 MB are truncated to the first
  50 steps + last 50 steps + every error step. ``Config.max_steps`` (200)
  is also enforced as a hard ceiling.
- Module-level opener with a ``Connection: keep-alive`` header so the
  underlying ``http.client`` connection can be reused where the server
  permits it.
"""
from __future__ import annotations

import json
import random
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

from . import config as _config

# 5 MB hard limit before step-level truncation kicks in.
_MAX_PAYLOAD_BYTES: int = 5 * 1024 * 1024
# Truncation window applied when payload exceeds the limit.
_TRUNC_HEAD: int = 50
_TRUNC_TAIL: int = 50

# Retry / backoff tuning (overridable per-call for tests).
_RETRY_ATTEMPTS: int = 3
_RETRY_BASE_DELAY: float = 1.0
_RETRY_MAX_DELAY: float = 10.0


class StoreError(RuntimeError):
    """Raised when the store cannot POST or GET a session."""


# ---------------------------------------------------------------------------
# Module-level opener (shared across requests) + keep-alive header.
# ---------------------------------------------------------------------------
class _KeepAliveHTTPHandler(urllib.request.HTTPHandler):
    """HTTP handler that requests keep-alive and pools connections per host.

    ``urllib`` itself doesn't keep connections alive across ``urlopen``
    calls — but by sending ``Connection: keep-alive`` and reusing a single
    opener we let HTTP/1.1 servers hold the socket open for the duration
    of a single response. Real cross-request pooling in stdlib requires
    ``http.client`` juggling that's out of scope here; the shared opener
    plus header is the documented mechanism.
    """

    def http_open(self, req: urllib.request.Request, *args, **kwargs):  # type: ignore[override]
        if not req.has_header("Connection"):
            req.add_unredirected_header("Connection", "keep-alive")
        return super().http_open(req, *args, **kwargs)

    def https_open(self, req: urllib.request.Request, *args, **kwargs):  # type: ignore[override]
        if not req.has_header("Connection"):
            req.add_unredirected_header("Connection", "keep-alive")
        return super().https_open(req, *args, **kwargs)


_opener: urllib.request.OpenerDirector = urllib.request.build_opener(
    _KeepAliveHTTPHandler()
)


def _api_url(path: str) -> str:
    base = _config.get_config().api_url.rstrip("/")
    if not path.startswith("/"):
        path = "/" + path
    return f"{base}{path}"


def _strip_internal(session: Dict[str, Any]) -> Dict[str, Any]:
    """Remove any private keys (prefixed with ``__``) before sending."""
    return {k: v for k, v in session.items() if not k.startswith("__")}


def _build_request(
    url: str,
    *,
    method: str = "POST",
    body: Optional[bytes] = None,
    token: Optional[str] = None,
    accept: str = "application/json",
) -> urllib.request.Request:
    headers = {
        "Content-Type": "application/json",
        "Accept": accept,
        "User-Agent": "replayai-python/0.7.3",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    return req


# ---------------------------------------------------------------------------
# Retry / backoff
# ---------------------------------------------------------------------------
def _backoff_delay(attempt: int, base: float, max_delay: float) -> float:
    """Exponential backoff with ±25% jitter.

    ``attempt`` is 1-based: first retry uses ``base * 2**0``, second uses
    ``base * 2**1``, etc. The result is capped at ``max_delay``.
    """
    delay = min(base * (2 ** (attempt - 1)), max_delay)
    jitter = delay * 0.25
    return max(0.0, delay + random.uniform(-jitter, jitter))


def _retryable_http_code(code: int) -> bool:
    return code == 429 or code >= 500


# ---------------------------------------------------------------------------
# Core request executor — always raises StoreError on failure.
# ---------------------------------------------------------------------------
def _do_request(req: urllib.request.Request) -> Dict[str, Any]:
    """Execute ``req`` and return the parsed JSON body.

    Raises :class:`StoreError` on every failure path: HTTP errors, network
    errors, and JSON parse errors. Retries up to ``_RETRY_ATTEMPTS`` times
    on HTTP 5xx / 429 and ``URLError`` with exponential backoff.
    """
    cfg = _config.get_config()
    timeout = float(cfg.timeout)
    last_exc: Optional[StoreError] = None

    for attempt in range(1, _RETRY_ATTEMPTS + 1):
        try:
            with _opener.open(req, timeout=timeout) as resp:
                raw = resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")
            except Exception:  # noqa: BLE001
                pass
            err = StoreError(f"HTTP {e.code} from {e.url}: {body or e.reason}")
            last_exc = err
            if _retryable_http_code(e.code) and attempt < _RETRY_ATTEMPTS:
                time.sleep(_backoff_delay(attempt, _RETRY_BASE_DELAY, _RETRY_MAX_DELAY))
                continue
            raise err
        except urllib.error.URLError as e:
            err = StoreError(f"network error: {e.reason}")
            last_exc = err
            if attempt < _RETRY_ATTEMPTS:
                time.sleep(_backoff_delay(attempt, _RETRY_BASE_DELAY, _RETRY_MAX_DELAY))
                continue
            raise err
        except OSError as e:
            # Socket timeouts, connection resets, etc.
            err = StoreError(f"network error: {e}")
            last_exc = err
            if attempt < _RETRY_ATTEMPTS:
                time.sleep(_backoff_delay(attempt, _RETRY_BASE_DELAY, _RETRY_MAX_DELAY))
                continue
            raise err

        # Success path — parse JSON. Empty body is a valid empty response.
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except json.JSONDecodeError as e:
            raise StoreError(f"invalid JSON response: {e}; body[:200]={raw[:200]!r}") from e

    # Defensive — the loop above always either returns or raises.
    raise last_exc or StoreError("request failed (no attempts completed)")


# ---------------------------------------------------------------------------
# Payload truncation
# ---------------------------------------------------------------------------
def _truncate_steps(steps: list, cfg: "_config.Config") -> list:
    """Apply ``max_steps`` ceiling to a step list.

    Always preserves steps whose type is ``error`` or status is ``failed``
    (so the dashboard always shows why a session failed). Non-error steps
    beyond the ceiling are dropped from the middle.

    Emits a warning to stderr when truncation occurs.
    """
    if len(steps) <= cfg.max_steps:
        return steps
    # Always keep error/failed steps.
    keep = [s for s in steps if s.get("type") == "error" or s.get("status") == "failed"]
    # Fill the remaining budget with non-error steps (head + tail).
    non_error = [s for s in steps if s not in keep]
    budget = max(0, cfg.max_steps - len(keep))
    if len(non_error) > budget:
        # Keep first half + last half of non-error steps.
        head = budget // 2
        tail = budget - head
        non_error = non_error[:head] + non_error[-tail:] if tail > 0 else non_error[:head]
    combined = keep + non_error
    # Re-sort by offset.
    combined.sort(key=lambda s: int(s.get("offsetMs", s.get("t", 0)) or 0))
    print(
        f"[replayai] warning: session has {len(steps)} steps; truncating to "
        f"max_steps={cfg.max_steps} (keeping all error/failed steps + head/tail of the rest)",
        file=sys.stderr,
    )
    return combined


def _enforce_payload_budget(
    payload: Dict[str, Any], cfg: "_config.Config"
) -> Dict[str, Any]:
    """If the serialized payload exceeds 5 MB, shrink the step list.

    Strategy: keep the first ``_TRUNC_HEAD`` steps, the last ``_TRUNC_TAIL``
    steps, and every step whose type is ``error`` (or status ``failed``).
    The combined list is deduped (preserving order) and re-sorted by
    ``offsetMs`` (falling back to ``t``).
    """
    steps = list(payload.get("steps") or [])
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    if len(body) <= _MAX_PAYLOAD_BYTES:
        return payload

    head = steps[:_TRUNC_HEAD]
    tail = steps[-_TRUNC_TAIL:] if len(steps) > _TRUNC_TAIL else []
    errors = [
        s for s in steps if s.get("type") == "error" or s.get("status") == "failed"
    ]

    seen: set = set()
    combined: list = []
    for s in head + tail + errors:
        key = id(s)
        if key in seen:
            continue
        seen.add(key)
        combined.append(s)
    combined.sort(key=lambda s: int(s.get("offsetMs", s.get("t", 0)) or 0))

    print(
        f"[replayai] warning: payload {len(body)} bytes exceeds 5 MB; truncating "
        f"steps from {len(steps)} to {len(combined)} (first {_TRUNC_HEAD} + last "
        f"{_TRUNC_TAIL} + all error steps)",
        file=sys.stderr,
    )
    new_payload = dict(payload)
    new_payload["steps"] = combined
    new_payload["truncated"] = True
    return new_payload


def _build_payload(
    session: Dict[str, Any], cfg: "_config.Config"
) -> tuple[bytes, bool]:
    """Strip internals, apply max_steps + payload-size truncation, serialize.

    Returns ``(body_bytes, truncated)`` where ``truncated`` is True if either
    the step-count cap or the 5 MB payload budget caused steps to be dropped.
    """
    payload = _strip_internal(session)
    original_step_count = len(payload.get("steps") or [])
    payload["steps"] = _truncate_steps(list(payload.get("steps") or []), cfg)
    payload = _enforce_payload_budget(payload, cfg)
    final_step_count = len(payload.get("steps") or [])
    truncated = final_step_count < original_step_count or bool(payload.get("truncated"))
    return json.dumps(payload, ensure_ascii=False).encode("utf-8"), truncated


# ---------------------------------------------------------------------------
# Public API (signatures unchanged)
# ---------------------------------------------------------------------------
def flush_session(session: Dict[str, Any]) -> Dict[str, Any]:
    """POST a recorded session to ``{API_URL}/api/sessions``.

    Returns the parsed JSON response (typically ``{"session": {...}}``).
    If the payload was truncated (step-count cap or 5 MB budget), a
    ``"truncated": True`` key is added to the returned dict so callers
    can detect data loss.

    In non-strict mode, ``StoreError`` is caught and logged; this is the
    ONLY place the SDK returns an empty ``{}`` on failure — ``_do_request``
    itself always raises. In strict mode the error propagates.
    """
    cfg = _config.get_config()
    body, truncated = _build_payload(session, cfg)
    req = _build_request(_api_url("/api/sessions"), body=body, token=cfg.token)
    try:
        result = _do_request(req)
        # Surface truncation to the caller so it's not silent data loss.
        if truncated and isinstance(result, dict):
            result["truncated"] = True
        return result
    except StoreError as e:
        if cfg.strict or _config.strict_mode:
            raise
        print(f"[replayai] warning: {e}", file=sys.stderr)
        return {}


def get_session(session_id: str) -> Dict[str, Any]:
    """GET ``/api/sessions/{id}`` — returns the full session with steps."""
    cfg = _config.get_config()
    req = _build_request(
        _api_url(f"/api/sessions/{session_id}"),
        method="GET",
        token=cfg.token,
    )
    return _do_request(req)


def get_session_list(limit: int = 100, offset: int = 0) -> Dict[str, Any]:
    """GET ``/api/sessions`` — list sessions (summaries only by default)."""
    cfg = _config.get_config()
    url = _api_url(f"/api/sessions?limit={limit}&offset={offset}")
    req = _build_request(url, method="GET", token=cfg.token)
    return _do_request(req)


def export_session(session_id: str, lang: str = "pytest") -> str:
    """GET ``/api/sessions/{id}/export?lang=...`` — returns the test text."""
    cfg = _config.get_config()
    url = _api_url(f"/api/sessions/{session_id}/export?lang={lang}")
    req = _build_request(url, method="GET", token=cfg.token, accept="text/plain")
    last_exc: Optional[StoreError] = None
    for attempt in range(1, _RETRY_ATTEMPTS + 1):
        try:
            with _opener.open(req, timeout=float(cfg.timeout)) as resp:
                return resp.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")
            except Exception:  # noqa: BLE001
                pass
            err = StoreError(f"HTTP {e.code} from {e.url}: {body or e.reason}")
            last_exc = err
            if _retryable_http_code(e.code) and attempt < _RETRY_ATTEMPTS:
                time.sleep(_backoff_delay(attempt, _RETRY_BASE_DELAY, _RETRY_MAX_DELAY))
                continue
            raise err
        except urllib.error.URLError as e:
            err = StoreError(f"network error: {e.reason}")
            last_exc = err
            if attempt < _RETRY_ATTEMPTS:
                time.sleep(_backoff_delay(attempt, _RETRY_BASE_DELAY, _RETRY_MAX_DELAY))
                continue
            raise err
        except OSError as e:
            err = StoreError(f"network error: {e}")
            last_exc = err
            if attempt < _RETRY_ATTEMPTS:
                time.sleep(_backoff_delay(attempt, _RETRY_BASE_DELAY, _RETRY_MAX_DELAY))
                continue
            raise err
    raise last_exc or StoreError("export failed (no attempts completed)")


def dashboard_url_for(session_id: str) -> str:
    """Build the dashboard deep-link for a session.

    The dashboard uses ``?s=<id>`` for deep-linking (see AppShell URL sync).
    Falls back to the API base if no dashboard URL is configured.
    """
    cfg = _config.get_config()
    base = (cfg.dashboard_url or cfg.api_url).rstrip("/")
    return f"{base}/?s={session_id}"
