"""Local file-based session storage.

Sessions are persisted as JSON files under ``{storage_path}/sessions/``.
Each file is named ``{session_id}.json`` where ``session_id`` is derived
from the session name + timestamp (or the API-assigned id when available).

This module is used by:
- ``context._local_persist()`` when ``storage`` includes ``local``
- ``cli._cmd_ui()`` to read sessions for the bundled dashboard server

The file format matches the API response shape so the dashboard can render
both cloud-fetched and locally-stored sessions identically.

**Security:** Session files are created with restrictive permissions
(0600 on POSIX) so recorded inputs/outputs — which may contain secrets
that slipped past redaction — aren't world-readable. The sessions
directory is created with 0700.
"""
from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Dict, List, Optional

from . import config as _config


# Default file mode for session JSON files (owner read/write only).
# On Windows this has no effect (chmod is a no-op), but the files inherit
# the user's default ACL which is typically single-user anyway.
_FILE_MODE = 0o600
_DIR_MODE = 0o700


def _storage_dir() -> str:
    """Return the absolute path to the sessions directory.

    Created with mode 0700 (owner-only) so other users on the system
    can't read recorded session data.
    """
    cfg = _config.get_config()
    base = cfg.storage_path
    sessions_dir = os.path.join(base, "sessions")
    os.makedirs(sessions_dir, exist_ok=True)
    # Tighten permissions on the directory (best-effort; no-op on Windows).
    try:
        os.chmod(sessions_dir, _DIR_MODE)
    except OSError:
        pass
    return sessions_dir


def _slugify(name: str) -> str:
    """Make a filesystem-safe slug from a session name."""
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "-", name or "session").strip("-")
    return slug or "session"


def save_session(session: Dict[str, Any]) -> str:
    """Persist a session dict to local storage and return its id.

    If the session already has an ``id`` (assigned by the API), use it.
    Otherwise generate a local id: ``ses_<slug>_<timestamp>``.

    The file is created with mode 0600 (owner read/write only) so recorded
    inputs/outputs — which may contain secrets that slipped past redaction —
    aren't world-readable.
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
    data = json.dumps(out, ensure_ascii=False, indent=2).encode("utf-8")
    # Write with O_CREAT | O_WRONLY | O_TRUNC and mode 0600.
    # os.open respects the mode on file creation (unlike open() which uses
    # the process umask). On Windows the mode bits are ignored.
    fd = os.open(full, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, _FILE_MODE)
    try:
        os.write(fd, data)
    finally:
        os.close(fd)
    # Belt-and-suspenders: chmod in case the file already existed (O_CREAT
    # doesn't change mode on an existing file).
    try:
        os.chmod(full, _FILE_MODE)
    except OSError:
        pass
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


def count_sessions() -> int:
    """Return the total number of locally-stored sessions (without loading content)."""
    sessions_dir = _storage_dir()
    try:
        return sum(1 for f in os.listdir(sessions_dir) if f.endswith(".json"))
    except FileNotFoundError:
        return 0


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
