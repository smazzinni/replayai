"""Helpers for propagating ReplayAI session state into subprocesses.

The SDK tracks the current session via :mod:`contextvars`, which does
**not** propagate to child processes spawned by
:mod:`multiprocessing` or :class:`concurrent.futures.ProcessPoolExecutor`.
These helpers provide a simple pickle/restore mechanism:

1. In the parent process, call :func:`get_session_data` to snapshot the
   current session as a plain (picklable) dict.
2. Pass that dict to the child process.
3. In the child, call :func:`set_session_data` (or use the
   :func:`session_context` context manager) to rehydrate it as the
   current session. Subsequent :func:`record_step` calls then land in
   the right place.

Example::

    from concurrent.futures import ProcessPoolExecutor
    from replayai import trace, record_step
    from replayai import get_session_data, set_session_data

    def work(session_data):
        set_session_data(session_data)
        record_step(type="tool_call", name="child_work")

    with trace("parent") as ctx:
        data = get_session_data()
        with ProcessPoolExecutor() as ex:
            ex.submit(work, data)

Steps recorded in the child are appended to ``data["steps"]`` in-place;
the parent can read them back after the future completes (note: the
parent's own ``ctx.session`` is not mutated — merge ``data["steps"]``
manually if needed).
"""
from __future__ import annotations

import contextlib
from typing import Any, Dict, Iterator, Optional

from .context import TraceContext, _current_session


def get_session_data() -> Optional[Dict[str, Any]]:
    """Return the current session as a picklable dict (or ``None``).

    The returned dict is a shallow copy of the active TraceContext's
    session dict with private keys (prefixed ``__``) stripped. Pass it
    across a process boundary, then call :func:`set_session_data` in
    the child to install it as the current session.
    """
    ctx = _current_session.get()
    if ctx is None or ctx.session is None:
        return None
    return {k: v for k, v in ctx.session.items() if not k.startswith("__")}


def set_session_data(
    session_dict: Optional[Dict[str, Any]],
) -> Optional[TraceContext]:
    """Install ``session_dict`` as the current session in this process.

    Returns the synthetic :class:`TraceContext` that wraps it (so the
    caller can later restore the previous context), or ``None`` if
    ``session_dict`` was ``None`` (no-op).
    """
    if session_dict is None:
        return None
    ctx = TraceContext(
        name=session_dict.get("name", "subprocess"),
        framework=session_dict.get("framework", "Custom"),
        agent=session_dict.get("agent"),
    )
    # Populate the session dict directly — skip the normal _enter flow
    # since the session was already started in the parent process.
    ctx.session = dict(session_dict)
    ctx._token_ctx = _current_session.set(ctx)
    return ctx


@contextlib.contextmanager
def session_context(
    session_dict: Optional[Dict[str, Any]],
) -> Iterator[Optional[TraceContext]]:
    """Context manager that sets the current session and restores on exit.

    Equivalent to::

        ctx = set_session_data(session_dict)
        try:
            ...
        finally:
            if ctx is not None:
                restore_previous()

    Yields the installed :class:`TraceContext` (or ``None``).
    """
    ctx = set_session_data(session_dict)
    try:
        yield ctx
    finally:
        if ctx is not None and ctx._token_ctx is not None:
            try:
                _current_session.reset(ctx._token_ctx)
            except Exception:  # noqa: BLE001
                _current_session.set(None)
            ctx._token_ctx = None
