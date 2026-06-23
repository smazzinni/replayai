"""Local file-based session storage.

Sessions are persisted as JSON files under ``{storage_path}/sessions/``.
Each file is named ``{session_id}.json`` where ``session_id`` is derived
from the session name + timestamp (or the API-assigned id when available).

This module is used by:
- ``context._local_persist()`` when ``storage`` includes ``local``
- ``cli._cmd_ui()`` to read sessions for the bundled dashboard server

The file format matches the API response shape so the dashboard can render
both cloud-fetched and locally-stored sessions identically.
"""
from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Dict, List, Optional

from . import config as _config


def _storage_dir() -> str:
    """Return the absolute path to the sessions directory."""
    cfg = _config.get_config()
    base = cfg.storage_path
    sessions_dir = os.path.join(base, "sessions")
    os.makedirs(sessions_dir, exist_ok=True)
    return sessions_dir


def _slugify(name: str) -> str:
    """Make a filesystem-safe slug from a session name."""
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", name or "session").strip("-")
    return slug or "session"


def save_session(session: Dict[str, Any]) -> str:
    """Persist a session dict to local storage and return its id.

    If the session already has an ``id`` (assigned by the API), use it.
    Otherwise generate a local id: ``ses_<slug>_<timestamp>``.
    """
    sessions_dir = _storage_dir()

    # Determine the session id.
    sid = session.get("id")
    if not sid:
        slug = _slugify(session.get("name", "session"))
        ts = int(time.time() * 1000)
        sid = f"ses_{slug}_{ts}"

    # Strip internal keys (prefixed with __).
    out = {k: v for k, v in session.items() if not k.startswith("__")}
    out["id"] = sid
    out.setdefault("storedAt", time.time())

    fname = f"{sid}.json"
    full = os.path.join(sessions_dir, fname)
    try:
        with open(full, "w", encoding="utf-8") as fh:
            json.dump(out, fh, ensure_ascii=False, indent=2)
    except OSError:
        raise
    return sid


def list_sessions(limit: int = 200, offset: int = 0) -> List[Dict[str, Any]]:
    """Return a list of session summaries (no steps), newest first."""
    sessions_dir = _storage_dir()
    try:
        files = [f for f in os.listdir(sessions_dir) if f.endswith(".json")]
    except FileNotFoundError:
        return []

    sessions: List[Dict[str, Any]] = []
    for fname in files:
        full = os.path.join(sessions_dir, fname)
        try:
            with open(full, "r", encoding="utf-8") as fh:
                data = json.load(fh)
        except (OSError, json.JSONDecodeError):
            continue
        # Summary (omit steps for the list view).
        summary = {k: v for k, v in data.items() if k != "steps"}
        summary["stepCount"] = len(data.get("steps", []))
        sessions.append(summary)

    # Sort by startedAt descending (fall back to storedAt).
    sessions.sort(
        key=lambda s: s.get("startedAt") or s.get("storedAt") or "",
        reverse=True,
    )
    return sessions[offset : offset + limit]


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Return a single session dict (with steps), or None if not found."""
    sessions_dir = _storage_dir()
    fname = f"{session_id}.json"
    full = os.path.join(sessions_dir, fname)
    if not os.path.isfile(full):
        return None
    try:
        with open(full, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError):
        return None


def get_stats() -> Dict[str, Any]:
    """Aggregate stats across all locally-stored sessions."""
    sessions = list_sessions(limit=10000)
    total = len(sessions)
    failed = sum(1 for s in sessions if s.get("status") == "failed")
    steps = sum(s.get("stepCount", 0) for s in sessions)
    cost = sum(float(s.get("costUsd", 0) or 0) for s in sessions)
    durations = [int(s.get("durationMs", 0) or 0) for s in sessions]
    avg_dur = sum(durations) / len(durations) if durations else 0
    return {
        "total": total,
        "failed": failed,
        "success": total - failed,
        "steps": steps,
        "costUsd": round(cost, 4),
        "failRate": round(failed / total, 4) if total > 0 else 0.0,
        "avgDurationMs": round(avg_dur),
    }
