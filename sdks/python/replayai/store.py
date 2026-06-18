"""HTTP store — POSTs recorded sessions to the ReplayAI API.

Uses only :mod:`urllib` so the core package remains stdlib-only. Failures
are surfaced as warnings unless strict mode is on.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

from . import config as _config


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
        "User-Agent": "replayai-python/0.4.1",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    return req


def _do_request(req: urllib.request.Request) -> Dict[str, Any]:
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        raise StoreError(
            f"HTTP {e.code} from {e.url}: {body or e.reason}"
        ) from None
    except urllib.error.URLError as e:
        raise StoreError(f"network error: {e.reason}") from e

    if not raw:
        return {}
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"_raw": raw}


class StoreError(RuntimeError):
    """Raised when the store cannot POST or GET a session."""


def flush_session(session: Dict[str, Any]) -> Dict[str, Any]:
    """POST a recorded session to ``{API_URL}/api/sessions``.

    Returns the parsed JSON response (containing ``{"session": {...}}``).
    In non-strict mode, network/HTTP failures are printed to stderr and
    re-raised only when strict mode is on.
    """
    cfg = _config.get_config()
    payload = _strip_internal(session)
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = _build_request(_api_url("/api/sessions"), body=body, token=cfg.token)
    try:
        result = _do_request(req)
    except StoreError as e:
        if cfg.strict or _config.strict_mode:
            raise
        print(f"[replayai] warning: {e}", file=sys.stderr)
        return {}
    return result


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
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read().decode("utf-8", errors="replace")
        except Exception:
            pass
        raise StoreError(f"HTTP {e.code} from {e.url}: {body or e.reason}") from None
    except urllib.error.URLError as e:
        raise StoreError(f"network error: {e.reason}") from e


def dashboard_url_for(session_id: str) -> str:
    """Build the dashboard deep-link for a session.

    The dashboard uses ``?s=<id>`` for deep-linking (see AppShell URL sync).
    Falls back to the API base if no dashboard URL is configured.
    """
    cfg = _config.get_config()
    base = (cfg.dashboard_url or cfg.api_url).rstrip("/")
    return f"{base}/?s={session_id}"
