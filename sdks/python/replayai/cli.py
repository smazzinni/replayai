"""ReplayAI CLI — `replayai record`, `replayai test`, `replayai ui`.

Usage:
    replayai record <script.py> [--project <slug>] [--tags a,b]
    replayai test [tests/replay/] [--live-llm]
    replayai ui [--storage ./replays] [--port 7373]

- `record` runs a Python script under a trace context and POSTs the session
  to the ReplayAI API.
- `test` runs pytest replay regression tests (deterministic, no API keys
  needed — mocks are served from recordings).
- `ui` starts the dashboard (delegates to the Next.js app if available).
"""
from __future__ import annotations

import argparse
import os
import runpy
import sys
from typing import List, Optional


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="replayai",
        description="ReplayAI CLI — record, test, and replay AI agent sessions.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # --- record ---
    rec = sub.add_parser("record", help="Run a script under a trace and record it.")
    rec.add_argument("script", help="Path to a Python script to run (e.g. agent.py).")
    rec.add_argument("--project", default=None, help="Project slug or ID.")
    rec.add_argument("--name", default=None, help="Session name (default: script name).")
    rec.add_argument("--tags", default=None, help="Comma-separated tags.")
    rec.add_argument("--framework", default="Custom", help="Agent framework.")

    # --- test ---
    tst = sub.add_parser("test", help="Run replay regression tests via pytest.")
    tst.add_argument("path", nargs="?", default="tests/replay/", help="Test path (default: tests/replay/).")
    tst.add_argument("--live-llm", action="store_true", help="Re-invoke real LLM calls (costs money).")
    tst.add_argument("--tb", default="short", help="pytest --tb style.")

    # --- ui ---
    ui = sub.add_parser("ui", help="Start the ReplayAI dashboard.")
    ui.add_argument("--port", type=int, default=7373, help="Port (default: 7373).")
    ui.add_argument("--storage", default="./replays", help="Local storage path.")
    ui.add_argument("--cloud", action="store_true", help="Use cloud sync.")
    ui.add_argument("--token", default=None, help="Cloud API token.")

    args = parser.parse_args(argv)

    if args.command == "record":
        return _cmd_record(args)
    elif args.command == "test":
        return _cmd_test(args)
    elif args.command == "ui":
        return _cmd_ui(args)
    return 1


def _cmd_record(args: argparse.Namespace) -> int:
    """Run a Python script under trace() and record the session."""
    from . import trace

    script = args.script
    if not os.path.isfile(script):
        print(f"error: script not found: {script}", file=sys.stderr)
        return 1

    name = args.name or os.path.basename(script).replace(".py", "")
    tags = [t.strip() for t in args.tags.split(",")] if args.tags else []
    project = args.project or os.environ.get("REPLAYAI_PROJECT")

    print(f"[replayai] recording: {script}")
    print(f"  name:      {name}")
    print(f"  project:   {project or '(auto)'}")
    print(f"  framework: {args.framework}")
    if tags:
        print(f"  tags:      {tags}")

    # Set up the trace context, run the script, then flush on exit.
    try:
        with trace(name, project=project, tags=tags, framework=args.framework):
            # Run the script as __main__ — any record_step calls inside it
            # will be captured.
            runpy.run_path(script, run_name="__main__")
        print(f"[replayai] session recorded — check the dashboard")
        return 0
    except SystemExit as e:
        # Script called sys.exit() — that's fine, the trace still flushed.
        print(f"[replayai] session recorded (script exited with code {e.code})")
        return 0 if e.code is None else int(e.code)
    except Exception as e:
        print(f"[replayai] error: {e}", file=sys.stderr)
        return 1


def _cmd_test(args: argparse.Namespace) -> int:
    """Run pytest replay regression tests."""
    # Set env vars that replay tests can read.
    if args.live_llm:
        os.environ["REPLAYAI_LIVE_LLM"] = "1"

    # Check pytest is available.
    try:
        import pytest
    except ImportError:
        print("error: pytest is not installed. Install with: pip install pytest", file=sys.stderr)
        return 1

    test_path = args.path
    if not os.path.exists(test_path):
        print(f"error: test path not found: {test_path}", file=sys.stderr)
        print("hint: export a failing session as a test first, then commit it to tests/replay/")
        return 1

    print(f"[replayai] running replay tests: {test_path}")
    if args.live_llm:
        print("[replayai] WARNING: live-llm mode — real LLM calls will be made (costs apply)")

    # Build pytest args.
    pytest_args = [test_path, f"--tb={args.tb}", "-v"]
    exit_code = pytest.main(pytest_args)

    if exit_code == 0:
        print("[replayai] all replay tests passed — no regressions detected")
    else:
        print(f"[replayai] replay tests failed (exit {exit_code}) — regressions detected", file=sys.stderr)
    return int(exit_code)


def _cmd_ui(args: argparse.Namespace) -> int:
    """Start the dashboard."""
    if args.cloud or args.token:
        if args.token:
            os.environ["REPLAYAI_TOKEN"] = args.token
        print(f"[replayai] starting dashboard in cloud mode on port {args.port}")
    else:
        os.environ["REPLAYAI_STORAGE_PATH"] = args.storage
        print(f"[replayai] starting dashboard in local mode on port {args.port}")
        print(f"  storage: {args.storage}")

    # Try to start the Next.js dev server if we're in the project directory.
    next_bin = os.path.join(os.getcwd(), "node_modules", ".bin", "next")
    if os.path.isfile(next_bin):
        print(f"[replayai] starting Next.js dashboard...")
        os.execvp(next_bin, [next_bin, "dev", "-p", str(args.port)])
    else:
        print(f"[replayai] dashboard URL: http://localhost:{args.port}")
        print("[replayai] (install the ReplayAI dashboard or run from the project root)")
        return 0


if __name__ == "__main__":
    sys.exit(main())
