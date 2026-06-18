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

__version__ = "0.4.1"

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
    "strict_mode",
    # Cost / redaction
    "estimate_cost",
    "estimate_step_cost",
    "redact_text",
    # Store
    "flush_session",
    "dashboard_url_for",
    "StoreError",
]


# Module-level property for `replayai.strict_mode` so that the documented
# `replayai.strict_mode = True` API proxies to the Config singleton.
# Module __setattr__ is not supported by Python, but swapping the module's
# __class__ to a ModuleType subclass with a real property descriptor works.
import sys as _sys


class _ReplayAIModule(_sys.modules[__name__].__class__):
    @property
    def strict_mode(self) -> bool:  # type: ignore[override]
        return get_config().strict

    @strict_mode.setter
    def strict_mode(self, value: bool) -> None:
        configure(strict=bool(value))


_sys.modules[__name__].__class__ = _ReplayAIModule
