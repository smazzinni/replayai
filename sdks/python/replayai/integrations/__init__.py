"""ReplayAI framework integrations.

Submodules:
- ``replayai.integrations.langchain`` — ``trace_chain``, ``trace_agent``,
  ``trace_graph`` decorators + ``ReplayCallbackHandler``.

Each submodule imports its framework lazily so ``pip install replayai``
remains dependency-free.
"""
from __future__ import annotations

__all__ = ["langchain"]
