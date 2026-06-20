"""``ReplaySession`` — load a recorded session and re-run it under mocks.

In this MVP, ``run()`` fetches the session from the API and returns a
:class:`~replayai.context.Trace` describing its steps and status. Full
re-execution against an agent object is left to the generated pytest
export (which the API produces server-side via ``/api/sessions/{id}/export``).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .context import Trace, TraceContext, _append_step, current_session
from .store import dashboard_url_for, export_session, get_session


class ReplaySession:
    """Load a recorded session and re-run it under mocked conditions.

    Example::

        replay = ReplaySession("ses_8fa1")
        replay.mock("issue_refund", '{"refund_id":"ref_3391"}')
        with replay.trace() as trace_obj:
            replay.run(agent="support-agent-v3", framework="LangChain")
        assert trace_obj.step_count == 8
    """

    def __init__(self, session_id: str, *, live_llm: bool = False) -> None:
        if not session_id:
            raise ValueError("session_id is required")
        self.session_id = session_id
        self.live_llm = live_llm
        self._mocks: Dict[str, Any] = {}
        self._cached: Optional[Dict[str, Any]] = None

    # ----- mocks -----
    def mock(self, fn_name: str, response: Any) -> None:
        """Override the recorded response for a tool/retrieval call.

        ``response`` may be a string or any JSON-serializable object.
        Subsequent ``run()`` calls substitute the mock output for any step
        whose ``name`` matches ``fn_name``.
        """
        if not fn_name:
            raise ValueError("fn_name is required")
        self._mocks[fn_name] = response

    def _apply_mocks(self, steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not self._mocks:
            return steps
        out: List[Dict[str, Any]] = []
        for s in steps:
            name = s.get("name") or ""
            if name in self._mocks:
                s = dict(s)
                mock_val = self._mocks[name]
                if isinstance(mock_val, (dict, list)):
                    import json

                    s["output"] = json.dumps(mock_val)
                else:
                    s["output"] = str(mock_val)
            out.append(s)
        return out

    # ----- fetch -----
    def _fetch(self) -> Dict[str, Any]:
        if self._cached is not None:
            return self._cached
        result = get_session(self.session_id)
        sess = result.get("session") if isinstance(result, dict) else None
        if not sess:
            raise RuntimeError(
                f"session {self.session_id!r} not found in ReplayAI store"
            )
        self._cached = sess
        return sess

    # ----- trace -----
    def trace(self) -> TraceContext:
        """Return a context manager yielding a :class:`Trace`.

        The Trace is populated from the loaded session's steps on exit,
        with mocks applied.
        """
        return _ReplayTraceContext(self)

    # ----- run -----
    def run(self, *, agent: str, framework: str = "Custom") -> Trace:
        """Re-execute the agent under recorded conditions.

        Fetches the session from the API, applies any registered mocks, and
        returns a :class:`Trace` view with ``step_count``, ``status``,
        ``steps``, etc. — matching the TypeScript SDK's return shape.
        """
        if not agent:
            raise ValueError("agent is required")
        sess = self._fetch()
        steps = self._apply_mocks(list(sess.get("steps", [])))
        trace = Trace()
        trace.steps = steps
        trace.step_count = len(steps)
        trace.status = sess.get("status", "success")
        trace.duration_ms = int(sess.get("durationMs", 0) or 0)
        trace.token_total = int(sess.get("tokenTotal", 0) or 0)
        trace.cost_usd = float(sess.get("costUsd", 0) or 0.0)
        trace.session_id = sess.get("id")
        trace.session_url = dashboard_url_for(sess.get("id", ""))
        # If there's an active replay trace context, append the steps into it
        # so the resulting Trace reflects what was "replayed".
        ctx = current_session()
        if ctx is not None and ctx.session is not None:
            for s in steps:
                _append_step(ctx.session, s)
        return trace

    # ----- export -----
    def export(self, lang: str = "pytest") -> str:
        """Generate a test file as a string. ``lang`` = ``pytest`` | ``jest``."""
        return export_session(self.session_id, lang=lang)

    def dashboard_url(self) -> str:
        """Convenience: the dashboard deep-link for this session."""
        return dashboard_url_for(self.session_id)


class _ReplayTraceContext(TraceContext):
    """A TraceContext that loads its step list from a stored session on enter."""

    def __init__(self, parent: "ReplaySession") -> None:
        super().__init__(
            name=f"replay:{parent.session_id}",
            framework="Replay",
            agent=f"replay:{parent.session_id}",
        )
        self._parent = parent
        self.trace_result: Trace = Trace()

    def __enter__(self) -> Trace:  # type: ignore[override]
        super().__enter__()
        return self.trace_result

    def __exit__(self, exc_type, exc, tb) -> bool:  # type: ignore[override]
        # Populate the Trace view from the loaded session before flushing.
        try:
            sess = self._parent._fetch()
            steps = self._parent._apply_mocks(list(sess.get("steps", [])))
            self.trace_result.steps = steps
            self.trace_result.step_count = len(steps)
            self.trace_result.status = sess.get("status", "success")
            self.trace_result.duration_ms = int(sess.get("durationMs", 0) or 0)
            self.trace_result.token_total = int(sess.get("tokenTotal", 0) or 0)
            self.trace_result.cost_usd = float(sess.get("costUsd", 0) or 0.0)
            self.trace_result.session_id = sess.get("id")
            self.trace_result.session_url = dashboard_url_for(sess.get("id", ""))
        except Exception:
            # Fall back to whatever the live trace captured.
            if self.session is not None:
                self.trace_result.steps = list(self.session.get("steps", []))
                self.trace_result.step_count = len(self.trace_result.steps)
                self.trace_result.status = self.session.get("status", "success")
        # Skip flushing a duplicate session back to the API — we're replaying.
        # Just restore the context stack.
        if self._token_ctx is not None:
            from . import context as _ctxmod

            try:
                _ctxmod._current_session.reset(self._token_ctx)
            except Exception:
                _ctxmod._current_session.set(self._prev_session)
            self._token_ctx = None
        return False

    async def __aenter__(self) -> Trace:  # type: ignore[override]
        return self.__enter__()

    async def __aexit__(self, exc_type, exc, tb) -> bool:  # type: ignore[override]
        return self.__exit__(exc_type, exc, tb)
