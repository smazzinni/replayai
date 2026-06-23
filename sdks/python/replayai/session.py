"""``ReplaySession`` — load a recorded session and re-run it under mocks.

``load()`` fetches the session from the API and returns a
:class:`~replayai.context.Trace` describing its steps and status. The
deprecated ``run()`` alias preserves the old call site (with a
``DeprecationWarning``) for backward compatibility. ``compare()`` runs a
live callable under a trace and diff-returns where it diverged from the
recorded steps.

Mock matching supports exact (default), prefix, regex, and input-
contains/input-exact criteria — combinable for fine-grained targeting.
"""
from __future__ import annotations

import re
import sys
import warnings
from typing import Any, Callable, Dict, List, Optional

from .context import (
    Trace,
    TraceContext,
    _append_step,
    current_session,
    trace,
)
from .store import dashboard_url_for, export_session, get_session


class ReplaySession:
    """Load a recorded session and re-run it under mocked conditions.

    Example::

        replay = ReplaySession("ses_8fa1")
        replay.mock("issue_refund", '{"refund_id":"ref_3391"}')
        trace_obj = replay.load()
        assert trace_obj.step_count == 8

    Flexible mock matching::

        replay.mock("search", resp, is_prefix=True)               # name starts with
        replay.mock(r"search_web\\(.*\\)", resp, is_regex=True)   # regex on name
        replay.mock("tool", resp, input_contains="NYC")           # case-insensitive
        replay.mock("tool", resp, input="expected")               # first 100 chars
        replay.mock("search", resp, is_prefix=True, input_contains="NYC")
    """

    def __init__(self, session_id: str, *, live_llm: bool = False) -> None:
        if not session_id:
            raise ValueError("session_id is required")
        self.session_id = session_id
        self.live_llm = live_llm
        # Ordered list of mock specs. Each spec is a dict with:
        #   name, response, is_regex, is_prefix, input_contains, input_exact
        self._mocks: List[Dict[str, Any]] = []
        self._cached: Optional[Dict[str, Any]] = None

    # ----- mocks -----
    def mock(
        self,
        fn_name: str,
        response: Any,
        *,
        is_regex: bool = False,
        is_prefix: bool = False,
        input_contains: Optional[str] = None,
        input: Optional[str] = None,
    ) -> None:
        """Override the recorded response for one or more steps.

        Matching strategy (all supplied criteria must match — AND):

        - ``is_regex=True`` — ``fn_name`` is a regex; matched against the
          step ``name`` via :func:`re.search`.
        - ``is_prefix=True`` — step ``name`` must start with ``fn_name``.
        - Default (neither) — exact equality on ``name``.
        - ``input_contains`` — substring test on step ``input`` (case-
          insensitive).
        - ``input`` — first 100 chars of step ``input`` must equal first
          100 chars of ``input``.

        ``response`` may be a string or any JSON-serializable object;
        subsequent ``load()`` calls substitute the mock output for any
        step that matches.
        """
        if not fn_name:
            raise ValueError("fn_name is required")
        # Pre-compile regex once for efficiency.
        compiled: Optional[re.Pattern] = None
        if is_regex:
            try:
                compiled = re.compile(fn_name)
            except re.error as e:
                raise ValueError(f"invalid regex {fn_name!r}: {e}") from e
        self._mocks.append(
            {
                "name": fn_name,
                "response": response,
                "is_regex": is_regex,
                "is_prefix": is_prefix,
                "input_contains": input_contains,
                "input_exact": input,
                "_compiled": compiled,
            }
        )

    def _step_matches_mock(
        self, step: Dict[str, Any], mock_spec: Dict[str, Any]
    ) -> bool:
        name = step.get("name") or ""
        step_input = step.get("input") or ""
        if not isinstance(step_input, str):
            step_input = str(step_input)

        # --- name matching ---
        if mock_spec["is_regex"]:
            compiled = mock_spec.get("_compiled")
            if compiled is None or not compiled.search(name):
                return False
        elif mock_spec["is_prefix"]:
            if not name.startswith(mock_spec["name"]):
                return False
        else:
            if name != mock_spec["name"]:
                return False

        # --- input matching (combined via AND) ---
        contains = mock_spec["input_contains"]
        if contains is not None and contains.lower() not in step_input.lower():
            return False

        exact = mock_spec["input_exact"]
        if exact is not None and step_input[:100] != str(exact)[:100]:
            return False

        return True

    def _apply_mocks(self, steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not self._mocks:
            return steps

        import json as _json

        matched = [False] * len(self._mocks)
        out: List[Dict[str, Any]] = []
        for s in steps:
            new_s = dict(s)
            for i, mock_spec in enumerate(self._mocks):
                if self._step_matches_mock(new_s, mock_spec):
                    matched[i] = True
                    mock_val = mock_spec["response"]
                    if isinstance(mock_val, (dict, list)):
                        new_s["output"] = _json.dumps(mock_val)
                    else:
                        new_s["output"] = str(mock_val)
                    break  # first matching mock wins
            out.append(new_s)

        # Warn about registered mocks that matched nothing.
        for i, m in enumerate(self._mocks):
            if not matched[i]:
                print(
                    f"[replayai] warning: mock '{m['name']}' did not match any "
                    f"step in session {self.session_id!r}",
                    file=sys.stderr,
                )
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

    # ----- load (formerly run) -----
    def load(self, *_args: Any, **_kwargs: Any) -> Trace:
        """Load the recorded session and return a :class:`Trace` view.

        Fetches the session from the API, applies any registered mocks,
        and returns a :class:`Trace` view with ``step_count``, ``status``,
        ``steps``, etc. — matching the TypeScript SDK's return shape.

        ``agent`` and ``framework`` keyword arguments are accepted for
        backward compatibility with the deprecated :meth:`run` method and
        emit a ``DeprecationWarning`` if supplied (they have no effect).
        """
        if _kwargs.get("agent") is not None or _kwargs.get("framework") is not None:
            warnings.warn(
                "agent/framework params on ReplaySession.load()/run() are "
                "deprecated and ignored — the loaded session already carries "
                "its original agent/framework.",
                DeprecationWarning,
                stacklevel=2,
            )
        sess = self._fetch()
        steps = self._apply_mocks(list(sess.get("steps", [])))
        out = Trace()
        out.steps = steps
        out.step_count = len(steps)
        out.status = sess.get("status", "success")
        out.duration_ms = int(sess.get("durationMs", 0) or 0)
        out.token_total = int(sess.get("tokenTotal", 0) or 0)
        out.cost_usd = float(sess.get("costUsd", 0) or 0.0)
        out.session_id = sess.get("id")
        out.session_url = dashboard_url_for(sess.get("id", ""))
        # If there's an active replay trace context, append the steps into
        # it so the resulting Trace reflects what was "replayed".
        ctx = current_session()
        if ctx is not None and ctx.session is not None:
            for s in steps:
                _append_step(ctx.session, s)
        return out

    # ----- run (deprecated alias) -----
    def run(self, *args: Any, **kwargs: Any) -> Trace:
        """Deprecated alias for :meth:`load`.

        .. deprecated:: 0.6.0
            Use :meth:`load` instead. The ``agent`` and ``framework``
            keyword arguments are accepted but ignored (with a
            ``DeprecationWarning``).
        """
        warnings.warn(
            "ReplaySession.run() is deprecated; use load() instead.",
            DeprecationWarning,
            stacklevel=2,
        )
        return self.load(*args, **kwargs)

    # ----- compare -----
    def compare(
        self,
        agent_callable: Callable[..., Any],
        inputs: Any = None,
    ) -> Dict[str, Any]:
        """Run ``agent_callable`` under a trace and diff against the recording.

        ``agent_callable`` is invoked inside a fresh ``trace()`` context
        with the loaded session's mocks applied to any steps it records.
        After it runs, the live step list is compared against the loaded
        step list (after mock substitution) and a divergence report is
        returned::

            {
              "matches": bool,
              "step_count_loaded": int,
              "step_count_live": int,
              "divergences": [
                {"step": i, "field": "output", "loaded": ..., "live": ...}
              ],
            }

        ``inputs`` is passed as a single positional argument to the
        callable when not ``None`` — use ``lambda: agent.run(...)`` for
        zero-argument agents.

        **Diff algorithm:** Uses LCS (Longest Common Subsequence) alignment
        by step name so that an inserted/removed step doesn't cascade into
        false divergences for every subsequent step. Steps are first aligned
        by name; aligned pairs are then compared field-by-field (output,
        status, model). Unaligned loaded steps are "removed"; unaligned live
        steps are "added".
        """
        sess = self._fetch()
        loaded_steps = self._apply_mocks(list(sess.get("steps", [])))

        # Apply mocks to live steps via the same _apply_mocks path by
        # funneling record_step output through the trace context. Since
        # the live trace records whatever the agent emits, we apply mocks
        # to the captured live steps after the fact as well.
        live_ctx_token = None
        ctx: Optional[TraceContext] = None
        try:
            ctx = trace(
                f"compare:{self.session_id}",
                framework="Replay",
                agent=f"compare:{self.session_id}",
            )
            ctx.__enter__()
            try:
                if inputs is not None:
                    agent_callable(inputs)
                else:
                    agent_callable()
            except Exception:
                # The exception is captured by the trace exit; we still
                # want to compute divergences against whatever ran.
                pass
            live_session = ctx.session or {}
            raw_live_steps = list(live_session.get("steps", []))
            live_steps = self._apply_mocks(raw_live_steps)
        finally:
            if ctx is not None:
                # Skip flushing the comparison trace to the API — we're
                # only inspecting it locally.
                try:
                    ctx._token_ctx = None  # prevent double-reset
                    from . import context as _ctxmod

                    _ctxmod._current_session.set(None)
                except Exception:  # noqa: BLE001
                    pass

        divergences = _diff_steps(loaded_steps, live_steps)

        return {
            "matches": len(divergences) == 0,
            "step_count_loaded": len(loaded_steps),
            "step_count_live": len(live_steps),
            "divergences": divergences,
        }

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


# ---------------------------------------------------------------------------
# Step diff — LCS-based alignment by step name.
# ---------------------------------------------------------------------------
def _diff_steps(
    loaded: List[Dict[str, Any]],
    live: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Compute divergences between two step lists using LCS alignment.

    Steps are aligned by ``name`` (with ``type`` as a tiebreaker) so that
    an inserted or removed step doesn't cascade into false divergences for
    every subsequent step. Aligned pairs are compared field-by-field;
    unaligned loaded steps are "removed"; unaligned live steps are "added".

    Returns a list of divergence dicts, each with:
        - ``step``: the loaded-side index (or live-side index for "added")
        - ``field``: "output" | "status" | "model" | "removed" | "added"
        - ``loaded``: the loaded value (or step name for removed/added)
        - ``live``: the live value (or step name for removed/added)
    """
    n, m = len(loaded), len(live)

    # Build the LCS table. Equality is based on step name + type (not output,
    # so that two steps with the same name but different outputs still align).
    def _match(a: Dict[str, Any], b: Dict[str, Any]) -> bool:
        return a.get("name") == b.get("name") and a.get("type") == b.get("type")

    # dp[i][j] = length of LCS of loaded[:i] and live[:j]
    dp: List[List[int]] = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            if _match(loaded[i - 1], live[j - 1]):
                dp[i][j] = dp[i - 1][j - 1] + 1
            else:
                dp[i][j] = max(dp[i - 1][j], dp[i][j - 1])

    # Backtrack to build the aligned pairs.
    pairs: List[tuple] = []  # (loaded_idx_or_None, live_idx_or_None)
    i, j = n, m
    while i > 0 and j > 0:
        if _match(loaded[i - 1], live[j - 1]):
            pairs.append((i - 1, j - 1))
            i -= 1
            j -= 1
        elif dp[i - 1][j] >= dp[i][j - 1]:
            pairs.append((i - 1, None))  # loaded step removed
            i -= 1
        else:
            pairs.append((None, j - 1))  # live step added
            j -= 1
    while i > 0:
        pairs.append((i - 1, None))
        i -= 1
    while j > 0:
        pairs.append((None, j - 1))
        j -= 1
    pairs.reverse()

    # Build divergences.
    divergences: List[Dict[str, Any]] = []
    for li, ri in pairs:
        if li is None:
            # Live step not in loaded — "added".
            divergences.append({
                "step": ri,
                "field": "added",
                "loaded": None,
                "live": live[ri].get("name"),
            })
            continue
        if ri is None:
            # Loaded step not in live — "removed".
            divergences.append({
                "step": li,
                "field": "removed",
                "loaded": loaded[li].get("name"),
                "live": None,
            })
            continue
        # Aligned — compare fields.
        l_step = loaded[li]
        r_step = live[ri]
        for field in ("output", "status", "model"):
            lv = l_step.get(field)
            rv = r_step.get(field)
            if lv != rv:
                divergences.append({
                    "step": li,
                    "field": field,
                    "loaded": lv,
                    "live": rv,
                })

    return divergences
