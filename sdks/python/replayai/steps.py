"""Step recording.

``record_step()`` appends a step to the current session (the innermost
:class:`~replayai.context.TraceContext` on the ContextVar stack).
``arecord_step()`` is the async variant — same behavior, awaitable so it
can be interleaved with async agent code without blocking the event loop.
"""
from __future__ import annotations

import asyncio
from typing import Any

from .context import TraceContext, _append_step, current_session


def record_step(**step: Any) -> None:
    """Record a step into the current trace.

    Keyword arguments (all optional except where noted):

    - ``type`` (str, default ``"llm_call"``) — one of
      ``llm_call``, ``tool_call``, ``retrieval``, ``decision``, ``error``.
    - ``name`` (str) — step label shown in the timeline.
    - ``model`` (str) — model name, used for cost estimation.
    - ``tokens_in`` / ``tokensIn`` (int) — prompt tokens.
    - ``tokens_out`` / ``tokensOut`` (int) — completion tokens.
    - ``input`` (str|dict) — step input (redacted before persist).
    - ``output`` (str|dict) — step output (redacted before persist).
    - ``status`` (str, default ``"success"``) — ``success`` | ``failed`` | ``running``.
    - ``offset_ms`` / ``offsetMs`` / ``t`` (int) — explicit offset from
      session start. Defaults to wall-clock since session start.
    - ``duration_ms`` / ``durationMs`` (int) — explicit step duration.
    """
    ctx = current_session()
    if ctx is None or ctx.session is None:
        # No active trace — silently drop unless strict.
        from . import config as _config

        if _config.strict_mode:
            raise RuntimeError(
                "record_step() called outside of an active trace() context."
            )
        return
    _append_step(ctx.session, step)


async def arecord_step(**step: Any) -> None:
    """Async variant of :func:`record_step`.

    Identical behavior — awaits a 0-delay yield first so callers can use
    ``await arecord_step(...)`` symmetrically inside async agent code.
    """
    # Yield control so the call signature stays awaitable even when there's
    # no real async work to do.
    await asyncio.sleep(0)
    record_step(**step)
