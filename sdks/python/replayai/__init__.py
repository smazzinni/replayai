"""ReplayAI Python SDK — public API.

Instrument Python agents, record sessions, replay them in the dashboard.

Quick start::

    from replayai import trace, record_step

    @trace("agent", project="proj", tags=["prod"])
    def handle(msg: str) -> str:
        record_step(type="llm_call", name="classify", status="success")
        return "ok"
"""
from __future__ import annotations

from .config import Config, configure, get_config
from .context import RecordingError, Trace, TraceContext, atrace, current_session, trace
from .cost import estimate_cost, estimate_step_cost
from .redact import redact_text
from .session import ReplaySession
from .steps import arecord_step, record_step
from .store import StoreError, dashboard_url_for, flush_session
from .subprocess_helper import get_session_data, session_context, set_session_data

__version__ = "0.7.2"

__all__ = [
    "__version__",
    # Tracing
    "trace",
    "atrace",
    "record_step",
    "arecord_step",
    "TraceContext",
    "Trace",
    "RecordingError",
    "current_session",
    # Replay
    "ReplaySession",
    # Configuration
    "configure",
    "get_config",
    "Config",
    "get_strict_mode",
    "set_strict_mode",
    # Cost / redaction
    "estimate_cost",
    "estimate_step_cost",
    "redact_text",
    # Store
    "flush_session",
    "dashboard_url_for",
    "StoreError",
    # Subprocess propagation
    "get_session_data",
    "set_session_data",
    "session_context",
]


# ---------------------------------------------------------------------------
# Strict mode — explicit get/set functions.
#
# Earlier versions (≤0.7.1) used a module __class__ swap hack to support
# `replayai.strict_mode = True`. That approach:
#   - Broke type checkers (mypy/pyright couldn't see the property).
#   - Could fail in embeddable Python builds that restrict __class__ reassignment.
#   - Was surprising to users expecting a plain attribute.
#
# The documented API is now:
#   replayai.set_strict_mode(True)   # instead of: replayai.strict_mode = True
#   replayai.get_strict_mode()       # instead of: replayai.strict_mode
#
# Backward compat: `replayai.strict_mode` still reads correctly (returns the
# current value) via a module-level variable kept in sync by get_config().
# Assigning to it is a no-op that prints a deprecation warning.
# ---------------------------------------------------------------------------
def get_strict_mode() -> bool:
    """Return the current strict-mode flag (mirrors ``config.strict``)."""
    return get_config().strict


def set_strict_mode(value: bool) -> None:
    """Enable or disable strict mode.

    When strict mode is on, recording/flushing failures raise
    :class:`RecordingError` instead of printing a warning.

    Equivalent to ``replayai.configure(strict=True)``.
    """
    configure(strict=bool(value))


# Backward compatibility: `replayai.strict_mode` (read) still works via
# module-level __getattr__ (PEP 562, Python 3.7+). Assignment is intercepted
# by __setattr__ to print a deprecation warning pointing to set_strict_mode().
# This is the clean, supported way to have a module-level property without
# swapping __class__ (which broke type checkers and some embeddable builds).
def __getattr__(name: str):  # type: ignore[no-untyped-def]
    if name == "strict_mode":
        return get_strict_mode()
    raise AttributeError(f"module 'replayai' has no attribute {name!r}")


def __setattr__(name: str, value: object) -> None:  # type: ignore[no-untyped-def]
    if name == "strict_mode":
        import warnings

        warnings.warn(
            "Setting `replayai.strict_mode` is deprecated — use "
            "`replayai.set_strict_mode(True)` instead.",
            DeprecationWarning,
            stacklevel=2,
        )
        set_strict_mode(bool(value))  # type: ignore[arg-type]
        return
    raise AttributeError(f"module 'replayai' has no attribute {name!r}")
