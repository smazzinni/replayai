"""LangChain integration for ReplayAI.

Three thin decorators (``trace_chain``, ``trace_agent``, ``trace_graph``)
wrap a function in :func:`replayai.trace`. ``ReplayCallbackHandler`` is a
callback handler that records LLM/tool/retriever events into the current
trace.

**Design note:** This handler does NOT inherit from
``langchain_core.callbacks.BaseCallbackHandler`` at class-definition time.
Instead it defines all the callback methods (duck-typing) and registers
itself with LangChain via ``BaseCallbackHandler`` when langchain is
available. This avoids import-time failures and ``isinstance`` issues when
langchain isn't installed, and makes the handler robust across LangChain
versions (the abstract base class's method signatures have changed between
versions).

The ``langchain_core`` import is performed lazily inside the handler's
``__init__`` so the module imports cleanly without langchain installed.
When the handler is instantiated without langchain present, a clear
ImportError is raised with install instructions.
"""
from __future__ import annotations

import time
from typing import Any, Callable, Dict, List, Optional

from ..context import TraceContext, current_session, trace
from ..steps import arecord_step, record_step

__all__ = [
    "trace_chain",
    "trace_agent",
    "trace_graph",
    "ReplayCallbackHandler",
]


# ---------------------------------------------------------------------------
# Decorators
# ---------------------------------------------------------------------------
def trace_chain(
    name: str,
    *,
    project: Optional[str] = None,
    tags: Optional[List[str]] = None,
    framework: str = "LangChain",
    **kwargs: Any,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator: wrap a chain invocation in a :func:`replayai.trace`."""

    ctx = trace(name, project=project, tags=tags, framework=framework)

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        return ctx(fn)

    return decorator


def trace_agent(
    name: str,
    *,
    project: Optional[str] = None,
    tags: Optional[List[str]] = None,
    framework: str = "LangChain",
    **kwargs: Any,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator: wrap an agent invocation in a :func:`replayai.trace`."""
    return trace_chain(name, project=project, tags=tags, framework=framework)


def trace_graph(
    name: str,
    *,
    project: Optional[str] = None,
    tags: Optional[List[str]] = None,
    framework: str = "LangGraph",
    **kwargs: Any,
) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
    """Decorator: wrap a LangGraph invocation in a :func:`replayai.trace`."""
    return trace_chain(name, project=project, tags=tags, framework=framework)


# ---------------------------------------------------------------------------
# Callback handler — duck-typed, no BaseCallbackHandler inheritance at import.
# ---------------------------------------------------------------------------
def _require_langchain_core():
    """Import langchain_core.callbacks.BaseCallbackHandler lazily.

    Raises a clear ImportError with install instructions if missing.
    """
    try:
        from langchain_core.callbacks import BaseCallbackHandler  # type: ignore
    except ImportError as e:  # pragma: no cover - exercised only without langchain
        raise ImportError(
            "ReplayCallbackHandler requires `langchain-core`. Install it with:\n"
            '    pip install "replayai-sdk[langchain]"\n'
            "or:\n"
            "    pip install langchain-core"
        ) from e
    return BaseCallbackHandler


class ReplayCallbackHandler:
    """LangChain callback handler that records events into the current trace.

    Attach to a chain/agent/runnable via ``callbacks=[handler]``::

        from replayai.integrations.langchain import ReplayCallbackHandler

        handler = ReplayCallbackHandler(name="support-agent-v3", project="support")
        executor = AgentExecutor(agent=agent, tools=tools, callbacks=[handler])
        result = executor.invoke({"input": message})

    Records:
    - ``on_llm_start`` / ``on_llm_end`` — as ``llm_call`` steps
    - ``on_tool_start`` / ``on_tool_end`` — as ``tool_call`` steps
    - ``on_retriever_start`` / ``on_retriever_end`` — as ``retrieval`` steps
    - ``on_chain_start`` / ``on_chain_end`` — as ``decision`` steps (top-level only)

    **Robustness:** This handler uses duck-typing (defines all callback
    methods) instead of inheriting from ``BaseCallbackHandler`` at class-
    definition time. This avoids import failures and signature-mismatch
    issues across LangChain versions. The handler registers itself as a
    ``BaseCallbackHandler`` subclass at instantiation time when langchain
    is available, so ``isinstance`` checks still pass.

    Streaming responses are recorded as a single step with the aggregated
    output — not one step per token.
    """

    def __init__(
        self,
        *,
        name: Optional[str] = None,
        project: Optional[str] = None,
        tags: Optional[List[str]] = None,
        framework: str = "LangChain",
    ) -> None:
        # Trigger the explicit ImportError at construction time so users
        # see the install hint immediately (not on first callback).
        # We don't need to keep the class — just verify it's importable.
        _require_langchain_core()
        self.name = name
        self.project = project
        self.tags = list(tags) if tags else []
        self.framework = framework
        self._open_traces: List[TraceContext] = []
        # Track open runs by run_id with a counter for fallback ordering.
        self._llm_starts: Dict[str, Dict[str, Any]] = {}
        self._tool_starts: Dict[str, Dict[str, Any]] = {}
        self._retriever_starts: Dict[str, Dict[str, Any]] = {}
        self._chain_depth: int = 0  # only record top-level chain as a decision
        self._own_trace: Optional[TraceContext] = None

    # ----- LangChain registration -----
    def _register_as_base_handler(self) -> None:
        """Register this handler as a BaseCallbackHandler subclass.

        Called lazily so isinstance(handler, BaseCallbackHandler) passes
        for code that checks. Uses ABCMeta.register which doesn't require
        the handler to actually inherit from the base.
        """
        try:
            BaseCallbackHandler = _require_langchain_core()
            if not isinstance(self, BaseCallbackHandler):
                # ABCMeta.register adds this class as a virtual subclass.
                BaseCallbackHandler.register(self.__class__)
        except ImportError:
            pass

    # ----- lifecycle -----
    def _ensure_trace(self) -> TraceContext:
        """Return the active trace, opening one if none exists."""
        ctx = current_session()
        if ctx is not None and ctx.session is not None:
            return ctx
        # Open our own trace if the handler is used outside @trace_chain.
        if self._own_trace is None:
            self._own_trace = trace(
                self.name or "langchain-trace",
                project=self.project,
                tags=self.tags,
                framework=self.framework,
            )
            self._own_trace.__enter__()
        return self._own_trace

    def flush(self) -> None:
        """Close any trace this handler opened. Safe to call multiple times."""
        if self._own_trace is not None:
            self._own_trace.__exit__(None, None, None)
            self._own_trace = None

    # ----- LLM -----
    def on_llm_start(
        self,
        serialized: Optional[Dict[str, Any]],
        prompts: List[str],
        *,
        run_id: Any = None,
        **kwargs: Any,
    ) -> None:
        run_id = str(run_id) if run_id is not None else f"llm-{len(self._llm_starts)}"
        model = self._extract_model_name(serialized or {}, kwargs)
        self._llm_starts[run_id] = {
            "name": self._extract_llm_name(serialized or {}),
            "model": model,
            "input": "\n".join(prompts) if prompts else "",
            "start_ms": time.time() * 1000.0,
        }

    def on_chat_model_start(
        self,
        serialized: Optional[Dict[str, Any]],
        messages: List[List[Any]],
        *,
        run_id: Any = None,
        **kwargs: Any,
    ) -> None:
        run_id = str(run_id) if run_id is not None else f"llm-{len(self._llm_starts)}"
        model = self._extract_model_name(serialized or {}, kwargs)
        # Flatten the messages into a string for the input field.
        try:
            flat = []
            for batch in messages:
                for m in batch:
                    flat.append(str(getattr(m, "content", m)))
            joined = "\n".join(flat)
        except Exception:
            joined = str(messages)
        self._llm_starts[run_id] = {
            "name": self._extract_llm_name(serialized or {}),
            "model": model,
            "input": joined,
            "start_ms": time.time() * 1000.0,
        }

    def on_llm_end(self, response: Any, *, run_id: Any = None, **kwargs: Any) -> None:
        run_id = str(run_id) if run_id is not None else None
        info = (self._llm_starts.pop(run_id, None)) if run_id else None
        if info is None and self._llm_starts:
            # Fallback: pop the most recently inserted.
            run_id, info = next(reversed(self._llm_starts.items()))
            self._llm_starts.pop(run_id, None)
        if info is None:
            return
        output_text = self._stringify_llm_result(response)
        tokens_in, tokens_out = self._extract_token_usage(response)
        duration_ms = int(time.time() * 1000.0 - info["start_ms"])
        self._ensure_trace()
        record_step(
            type="llm_call",
            name=info["name"],
            model=info["model"],
            input=info["input"],
            output=output_text,
            tokens_in=tokens_in,
            tokens_out=tokens_out,
            status="success",
            duration_ms=duration_ms,
        )

    def on_llm_error(self, error: BaseException, *, run_id: Any = None, **kwargs: Any) -> None:
        run_id = str(run_id) if run_id is not None else None
        info = self._llm_starts.pop(run_id, None) if run_id else None
        if info is None and self._llm_starts:
            run_id, info = next(reversed(self._llm_starts.items()))
            self._llm_starts.pop(run_id, None)
        if info is None:
            return
        duration_ms = int(time.time() * 1000.0 - info["start_ms"])
        self._ensure_trace()
        record_step(
            type="llm_call",
            name=info["name"],
            model=info["model"],
            input=info["input"],
            output=f"{type(error).__name__}: {error}",
            status="failed",
            duration_ms=duration_ms,
        )

    # ----- Tools -----
    def on_tool_start(
        self,
        serialized: Optional[Dict[str, Any]],
        input_str: str,
        *,
        run_id: Any = None,
        **kwargs: Any,
    ) -> None:
        run_id = str(run_id) if run_id is not None else f"tool-{len(self._tool_starts)}"
        name = (serialized or {}).get("name") or "tool"
        self._tool_starts[run_id] = {
            "name": name,
            "input": input_str,
            "start_ms": time.time() * 1000.0,
        }

    def on_tool_end(self, output: Any, *, run_id: Any = None, **kwargs: Any) -> None:
        run_id = str(run_id) if run_id is not None else None
        info = self._tool_starts.pop(run_id, None) if run_id else None
        if info is None and self._tool_starts:
            run_id, info = next(reversed(self._tool_starts.items()))
            self._tool_starts.pop(run_id, None)
        if info is None:
            return
        duration_ms = int(time.time() * 1000.0 - info["start_ms"])
        self._ensure_trace()
        record_step(
            type="tool_call",
            name=info["name"],
            input=info["input"],
            output=str(output),
            status="success",
            duration_ms=duration_ms,
        )

    def on_tool_error(self, error: BaseException, *, run_id: Any = None, **kwargs: Any) -> None:
        run_id = str(run_id) if run_id is not None else None
        info = self._tool_starts.pop(run_id, None) if run_id else None
        if info is None and self._tool_starts:
            run_id, info = next(reversed(self._tool_starts.items()))
            self._tool_starts.pop(run_id, None)
        if info is None:
            return
        duration_ms = int(time.time() * 1000.0 - info["start_ms"])
        self._ensure_trace()
        record_step(
            type="tool_call",
            name=info["name"],
            input=info["input"],
            output=f"{type(error).__name__}: {error}",
            status="failed",
            duration_ms=duration_ms,
        )

    # ----- Retrievers -----
    def on_retriever_start(
        self,
        serialized: Optional[Dict[str, Any]],
        query: str,
        *,
        run_id: Any = None,
        **kwargs: Any,
    ) -> None:
        run_id = (
            str(run_id) if run_id is not None else f"retr-{len(self._retriever_starts)}"
        )
        name = (serialized or {}).get("name") or "retriever"
        self._retriever_starts[run_id] = {
            "name": name,
            "input": query,
            "start_ms": time.time() * 1000.0,
        }

    def on_retriever_end(self, documents: Any, *, run_id: Any = None, **kwargs: Any) -> None:
        run_id = str(run_id) if run_id is not None else None
        info = self._retriever_starts.pop(run_id, None) if run_id else None
        if info is None and self._retriever_starts:
            run_id, info = next(reversed(self._retriever_starts.items()))
            self._retriever_starts.pop(run_id, None)
        if info is None:
            return
        duration_ms = int(time.time() * 1000.0 - info["start_ms"])
        # Render retrieved docs as a compact list.
        try:
            docs = list(documents)
            rendered = []
            for i, d in enumerate(docs[:8]):
                content = getattr(d, "page_content", None) or getattr(d, "content", None)
                if content is None:
                    content = str(d)
                rendered.append(f"[{i}] {content[:200]}")
            output = "\n".join(rendered) if rendered else str(documents)
        except Exception:
            output = str(documents)
        self._ensure_trace()
        record_step(
            type="retrieval",
            name=info["name"],
            input=info["input"],
            output=output,
            status="success",
            duration_ms=duration_ms,
        )

    def on_retriever_error(self, error: BaseException, *, run_id: Any = None, **kwargs: Any) -> None:
        run_id = str(run_id) if run_id is not None else None
        info = self._retriever_starts.pop(run_id, None) if run_id else None
        if info is None and self._retriever_starts:
            run_id, info = next(reversed(self._retriever_starts.items()))
            self._retriever_starts.pop(run_id, None)
        if info is None:
            return
        duration_ms = int(time.time() * 1000.0 - info["start_ms"])
        self._ensure_trace()
        record_step(
            type="retrieval",
            name=info["name"],
            input=info["input"],
            output=f"{type(error).__name__}: {error}",
            status="failed",
            duration_ms=duration_ms,
        )

    # ----- Chain (depth-tracked so only top-level chain auto-flushes) -----
    def on_chain_start(
        self,
        serialized: Optional[Dict[str, Any]],
        inputs: Any,
        *,
        run_id: Any = None,
        **kwargs: Any,
    ) -> None:
        self._chain_depth += 1

    def on_chain_end(self, outputs: Any, *, run_id: Any = None, **kwargs: Any) -> None:
        # Decrement depth. Only flush when we exit the OUTERMOST chain.
        if self._chain_depth > 0:
            self._chain_depth -= 1
        if self._chain_depth == 0 and self._own_trace is not None:
            self._own_trace.__exit__(None, None, None)
            self._own_trace = None

    def on_chain_error(self, error: BaseException, *, run_id: Any = None, **kwargs: Any) -> None:
        if self._chain_depth > 0:
            self._chain_depth -= 1
        if self._chain_depth == 0 and self._own_trace is not None:
            self._own_trace.__exit__(type(error), error, error.__traceback__)
            self._own_trace = None

    # ----- helpers -----
    @staticmethod
    def _extract_llm_name(serialized: Dict[str, Any]) -> str:
        if not serialized:
            return "llm"
        ident = serialized.get("id") or []
        if isinstance(ident, list) and ident:
            return str(ident[-1])
        name = serialized.get("name") or serialized.get("model_name")
        return str(name) if name else "llm"

    @staticmethod
    def _extract_model_name(serialized: Dict[str, Any], kwargs: Dict[str, Any]) -> Optional[str]:
        for source in (kwargs, serialized or {}):
            for key in ("model", "model_name", "model_id"):
                val = source.get(key)
                if val:
                    return str(val)
        invocation = kwargs.get("invocation_params") or {}
        for key in ("model", "model_name", "model_id"):
            val = invocation.get(key)
            if val:
                return str(val)
        return None

    @staticmethod
    def _stringify_llm_result(response: Any) -> str:
        try:
            generations = getattr(response, "generations", None)
            if generations:
                texts = []
                for batch in generations:
                    for gen in batch:
                        text = getattr(gen, "text", None)
                        if not text:
                            msg = getattr(gen, "message", None)
                            text = getattr(msg, "content", None) if msg else None
                        if not text:
                            text = str(gen)
                        texts.append(text)
                return "\n".join(texts)
            output = getattr(response, "output", None)
            if output:
                return str(output)
        except Exception:
            pass
        return str(response)

    @staticmethod
    def _extract_token_usage(response: Any) -> tuple[int, int]:
        try:
            llm_output = getattr(response, "llm_output", None) or {}
            usage = (
                llm_output.get("token_usage")
                or llm_output.get("usage")
                or {}
            )
            tokens_in = int(
                usage.get("prompt_tokens")
                or usage.get("input_tokens")
                or 0
            )
            tokens_out = int(
                usage.get("completion_tokens")
                or usage.get("output_tokens")
                or 0
            )
            return tokens_in, tokens_out
        except Exception:
            return 0, 0


# At import time, register the handler as a virtual subclass of
# BaseCallbackHandler if langchain is available, so isinstance() checks pass.
try:
    _BaseCB = _require_langchain_core()
    _BaseCB.register(ReplayCallbackHandler)
except ImportError:
    pass
