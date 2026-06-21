"""TraceContext — the object returned by ``trace()`` / ``atrace()``.

It is both a context manager and a decorator-wrapper. On enter it pushes a
new session dict onto a threadlocal/ContextVar stack; on exit it computes
final totals and flushes the session via :mod:`replayai.store`.
"""
from __future__ import annotations

import contextvars
import functools
import inspect
import json
import random
import sys
import time
import traceback
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterator, List, Optional

from . import config as _config
from .cost import estimate_cost
from .redact import redact_text
from .store import flush_session


# ContextVar so async tasks get their own current-session stack naturally.
_current_session: contextvars.ContextVar[Optional["TraceContext"]] = (
    contextvars.ContextVar("replayai_current_session", default=None)
)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _now_ms() -> float:
    return time.time() * 1000.0


def _is_async_callable(fn: Callable[..., Any]) -> bool:
    """Detect coroutine functions (and wrapped partials)."""
    if inspect.iscoroutinefunction(fn):
        return True
    wrapped = getattr(fn, "__wrapped__", None)
    if wrapped is not None and wrapped is not fn:
        return _is_async_callable(wrapped)
    return False


class RecordingError(RuntimeError):
    """Raised in strict mode when recording or flushing fails."""


@dataclass
class Trace:
    """Lightweight view of a recorded trace, returned from ``ReplaySession.trace()``."""

    step_count: int = 0
    status: str = "success"
    steps: List[Dict[str, Any]] = field(default_factory=list)
    duration_ms: int = 0
    token_total: int = 0
    cost_usd: float = 0.0
    session_id: Optional[str] = None
    session_url: Optional[str] = None

    @property
    def stepCount(self) -> int:  # camelCase alias for parity with TS SDK
        return self.step_count

    @property
    def durationMs(self) -> int:
        return self.duration_ms

    @property
    def tokenTotal(self) -> int:
        return self.token_total

    @property
    def costUsd(self) -> float:
        return self.cost_usd


class TraceContext:
    """Context manager + decorator wrapper produced by ``trace()``.

    Usage as a context manager::

        with trace("agent") as ctx:
            record_step(type="llm_call", name="classify", ...)

    Usage as a decorator::

        @trace("agent", project="proj", tags=["prod"])
        def handle(msg: str) -> str:
            record_step(...)
            return "ok"

    Async usage mirrors both forms via ``atrace`` / ``async with``.
    """

    def __init__(
        self,
        name: str,
        *,
        project: Optional[str] = None,
        tags: Optional[List[str]] = None,
        framework: str = "Custom",
        started_at: Optional[datetime] = None,
        agent: Optional[str] = None,
        sample_rate: Optional[float] = None,
        _force_async: bool = False,
    ) -> None:
        self.name = name
        self.project = project
        self.tags = list(tags) if tags else []
        self.framework = framework
        self.started_at = started_at
        self.agent = agent or name
        self._sample_rate = sample_rate
        self._force_async = _force_async

        # Sample-rate check is evaluated at enter time so configure() updates
        # take effect for subsequent invocations.
        self._sampled: bool = True

        # Session state, populated on enter.
        self.session: Optional[Dict[str, Any]] = None
        self._start_ms: float = 0.0
        self._token_ctx: Optional[contextvars.Token] = None
        self._prev_session: Optional[TraceContext] = None

    # ----- decorator surface -----
    def __call__(self, fn: Callable[..., Any]) -> Callable[..., Any]:
        """Use as ``@trace(...)``. Returns a wrapped function.

        Each call to the wrapped function re-enters a fresh TraceContext so
        each invocation gets its own session/timeline.
        """
        if not callable(fn):
            raise TypeError(
                "TraceContext used as a decorator expects a callable. "
                "For manual scopes use `with trace(...):` instead."
            )
        is_async = self._force_async or _is_async_callable(fn)
        # Bind the wrapped fn + flags on the *template* (self) so subsequent
        # re-enter calls share them. _reenter copies these forward.
        self._wrapped = fn
        self._wrapped_is_async = is_async
        template = self

        if is_async:
            @functools.wraps(fn)
            async def async_wrapper(*args, **kwargs):
                ctx = template._reenter()
                async with ctx:
                    return await fn(*args, **kwargs)

            return async_wrapper

        @functools.wraps(fn)
        def sync_wrapper(*args, **kwargs):
            ctx = template._reenter()
            with ctx:
                return fn(*args, **kwargs)

        return sync_wrapper

    # ----- context manager surface -----
    def __enter__(self) -> "TraceContext":
        return self._enter()

    def __exit__(self, exc_type, exc, tb) -> bool:
        self._exit(exc_type, exc, tb)
        # Never suppress the user's exception.
        return False

    async def __aenter__(self) -> "TraceContext":
        return self._enter()

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        self._exit(exc_type, exc, tb)
        return False

    # ----- internal helpers -----
    def _reenter(self) -> "TraceContext":
        """Return a fresh TraceContext for one decorator invocation.

        Each call to a decorated function gets a new context (with its own
        start time / steps) sharing the original name/tags/project.
        """
        ctx = TraceContext(
            self.name,
            project=self.project,
            tags=list(self.tags),
            framework=self.framework,
            started_at=None,  # re-stamped per invocation
            agent=self.agent,
            sample_rate=self._sample_rate,
            _force_async=self._force_async,
        )
        return ctx

    def _enter(self) -> "TraceContext":
        cfg = _config.get_config()
        # Resolve sample rate: explicit override > config.
        rate = self._sample_rate if self._sample_rate is not None else cfg.sample_rate
        self._sampled = random.random() < max(0.0, min(1.0, float(rate)))

        start = self.started_at if self.started_at is not None else datetime.now(
            timezone.utc
        )
        self._start_ms = _now_ms()
        self.session = {
            "name": self.name,
            "agent": self.agent,
            "framework": self.framework,
            "status": "running",
            "startedAt": start.astimezone(timezone.utc)
            .isoformat()
            .replace("+00:00", "Z"),
            "durationMs": 0,
            "tokenTotal": 0,
            "costUsd": 0.0,
            "tags": list(self.tags),
            "steps": [],
            # Project resolution: explicit > env > first project on the API.
            "projectSlug": self.project or cfg.project,
            "projectId": None,
        }
        # Push onto the contextvar stack so record_step() can find us.
        self._prev_session = _current_session.get()
        self._token_ctx = _current_session.set(self)
        return self

    def _exit(self, exc_type, exc, tb) -> None:
        if self.session is None:
            # Never entered — nothing to do.
            return
        # Restore previous session on the stack.
        if self._token_ctx is not None:
            try:
                _current_session.reset(self._token_ctx)
            except Exception:
                _current_session.set(self._prev_session)
            self._token_ctx = None

        end_ms = _now_ms()
        duration = int(end_ms - self._start_ms)
        self.session["durationMs"] = duration

        steps = self.session["steps"]
        # If steps had explicit durationMs, the session duration is the max
        # end-time across them; otherwise use wall-clock.
        step_end_max = 0
        for s in steps:
            t = int(s.get("offsetMs", s.get("t", 0)) or 0)
            d = int(s.get("durationMs", 0) or 0)
            step_end_max = max(step_end_max, t + d)
        self.session["durationMs"] = max(duration, step_end_max)

        token_total = sum(
            int(s.get("tokensIn", 0) or 0) + int(s.get("tokensOut", 0) or 0)
            for s in steps
        )
        self.session["tokenTotal"] = token_total
        try:
            self.session["costUsd"] = estimate_cost(
                [
                    {
                        "model": s.get("model"),
                        "tokens_in": s.get("tokensIn", 0) or 0,
                        "tokens_out": s.get("tokensOut", 0) or 0,
                    }
                    for s in steps
                ]
            )
        except Exception:
            self.session["costUsd"] = 0.0

        # Derive final status from exception / step statuses.
        if exc is not None:
            self.session["status"] = "failed"
            # Capture the exception as a final error step so the dashboard
            # shows why it failed. The output is structured JSON (per the
            # v0.6.0 spec) so the dashboard can render frame-by-frame.
            exception_data = _capture_exception(exc_type, exc, tb)
            steps.append(
                {
                    "type": "error",
                    "name": exc_type.__name__ if exc_type else "Error",
                    "t": duration,
                    "offsetMs": duration,
                    "durationMs": 0,
                    "status": "failed",
                    "model": None,
                    "tokensIn": 0,
                    "tokensOut": 0,
                    "input": "",
                    "output": json.dumps(exception_data, ensure_ascii=False),
                }
            )
        elif any(s.get("status") == "failed" for s in steps):
            self.session["status"] = "failed"
        elif steps:
            self.session["status"] = "success"
        else:
            self.session["status"] = "success"

        cfg = _config.get_config()
        # Sampling: drop non-failed sessions when not sampled. Failures are
        # always recorded unless the user explicitly opts out via
        # ``Config.always_record_failures = False``.
        if not self._sampled:
            is_failure = self.session["status"] == "failed"
            record_failures = cfg.always_record_failures
            if not (is_failure and record_failures):
                return

        # Only flush when storage includes "cloud". Local-only mode persists
        # to disk in MVP — print a notice.
        try:
            if cfg.storage in ("cloud", "both"):
                flush_session(self.session)
            if cfg.storage in ("local", "both"):
                _local_persist(self.session)
        except Exception as e:  # noqa: BLE001
            if cfg.strict or _config.strict_mode:
                raise RecordingError(f"ReplayAI recording failed: {e}") from e
            print(f"[replayai] warning: failed to flush session: {e}", file=sys.stderr)

    # ----- public step recording -----
    def record_step(self, **step: Any) -> None:
        """Append a step to the current session.

        See :func:`replayai.steps.record_step` for the full keyword list.
        """
        if self.session is None:
            # Not currently inside a `with` block. Use the ambient context.
            from .steps import record_step as _rs

            _rs(**step)
            return
        _append_step(self.session, step)


def _append_step(session: Dict[str, Any], step: Dict[str, Any]) -> None:
    """Normalize + redact + append a step dict to the session."""
    name = step.get("name") or f"step {len(session['steps']) + 1}"
    step_type = step.get("type") or "llm_call"
    status = step.get("status") or "success"
    model = step.get("model")
    tokens_in = int(step.get("tokens_in", step.get("tokensIn", 0)) or 0)
    tokens_out = int(step.get("tokens_out", step.get("tokensOut", 0)) or 0)
    input_val = step.get("input")
    output_val = step.get("output")

    # offsetMs: explicit > inferred from current step count
    offset_ms_raw = step.get("offset_ms", step.get("offsetMs", step.get("t", -1)))
    offset_ms = int(offset_ms_raw) if offset_ms_raw is not None else -1
    if offset_ms < 0:
        # Infer from session start time.
        start_ms = _session_start_ms(session)
        offset_ms = max(0, int(_now_ms() - start_ms))
    duration_ms = int(step.get("duration_ms", step.get("durationMs", 0)) or 0)

    session["steps"].append(
        {
            "type": step_type,
            "name": name,
            "t": offset_ms,
            "offsetMs": offset_ms,
            "durationMs": duration_ms,
            "status": status,
            "model": model,
            "tokensIn": tokens_in,
            "tokensOut": tokens_out,
            "input": redact_text(input_val) if input_val is not None else "",
            "output": redact_text(output_val) if output_val is not None else "",
        }
    )


_SESSION_START_KEY = "__replayai_start_ms"


def _session_start_ms(session: Dict[str, Any]) -> float:
    """Get (or stash) the wall-clock ms at which a session began."""
    val = session.get(_SESSION_START_KEY)
    if val is None:
        val = _now_ms()
        session[_SESSION_START_KEY] = val
    return float(val)


def _local_persist(session: Dict[str, Any]) -> None:
    """MVP local-storage: write the session JSON into the configured dir."""
    import json
    import os

    cfg = _config.get_config()
    path = cfg.storage_path
    try:
        os.makedirs(path, exist_ok=True)
        ts = int(time.time() * 1000)
        fname = f"{session.get('name', 'session').replace('/', '_')}-{ts}.json"
        full = os.path.join(path, fname)
        # Strip internal keys.
        out = {k: v for k, v in session.items() if not k.startswith("__")}
        with open(full, "w", encoding="utf-8") as fh:
            json.dump(out, fh, ensure_ascii=False, indent=2)
    except Exception as e:  # noqa: BLE001
        if cfg.strict or _config.strict_mode:
            raise
        print(f"[replayai] warning: local persist failed: {e}", file=sys.stderr)


def _capture_exception(
    exc_type: Any, exc: BaseException, tb: Any
) -> Dict[str, Any]:
    """Build a structured exception record for the dashboard.

    Returns a JSON-serializable dict with ``exception_type``, ``message``,
    ``frames`` (list of file/line/function/code dicts), ``raw_traceback``,
    and ``extraction_failed`` (set True if frame extraction raised — in
    which case ``frames`` is empty and only the raw string is preserved).
    """
    raw_tb = ""
    try:
        raw_tb = "".join(traceback.format_exception(exc_type, exc, tb))
    except Exception:  # noqa: BLE001
        raw_tb = traceback.format_exc() or ""

    try:
        frames = [
            {
                "file": f.filename,
                "line": f.lineno,
                "function": f.name,
                "code": f.line,
            }
            for f in traceback.extract_tb(tb) if tb is not None
        ]
        extraction_failed = False
    except Exception:  # noqa: BLE001
        frames = []
        extraction_failed = True

    return {
        "exception_type": (exc.__class__.__name__ if exc is not None else
                           (exc_type.__name__ if exc_type else "Error")),
        "message": str(exc) if exc is not None else "",
        "frames": frames,
        "raw_traceback": raw_tb,
        "extraction_failed": extraction_failed,
    }


# ----- public factories -----
def trace(
    name: str,
    *,
    project: Optional[str] = None,
    tags: Optional[List[str]] = None,
    framework: str = "Custom",
    started_at: Optional[datetime] = None,
    agent: Optional[str] = None,
    sample_rate: Optional[float] = None,
) -> TraceContext:
    """Open a new trace.

    Usable as a decorator (``@trace("agent", ...)``) or a context manager
    (``with trace("agent") as ctx:``). Returns a :class:`TraceContext`.
    """
    return TraceContext(
        name,
        project=project,
        tags=tags,
        framework=framework,
        started_at=started_at,
        agent=agent,
        sample_rate=sample_rate,
    )


def atrace(
    name: str,
    *,
    project: Optional[str] = None,
    tags: Optional[List[str]] = None,
    framework: str = "Custom",
    started_at: Optional[datetime] = None,
    agent: Optional[str] = None,
    sample_rate: Optional[float] = None,
) -> TraceContext:
    """Async variant of :func:`trace`.

    Same surface — works as ``@atrace("...")`` on a coroutine function or
    ``async with atrace("..."):``. The returned :class:`TraceContext` is the
    same; the flag just nudges async detection when the wrapped callable is
    not directly a coroutine function (e.g. a class with ``__call__``).
    """
    return TraceContext(
        name,
        project=project,
        tags=tags,
        framework=framework,
        started_at=started_at,
        agent=agent,
        sample_rate=sample_rate,
        _force_async=True,
    )


def current_session() -> Optional[TraceContext]:
    """Return the innermost active TraceContext, if any."""
    return _current_session.get()
