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
    rec.add_argument("--storage", default="./ReplayAI", help="Local storage path (default: ./ReplayAI).")
    rec.add_argument("--cloud", action="store_true", help="Also sync to cloud API (storage=both).")

    # --- test ---
    tst = sub.add_parser("test", help="Run replay regression tests via pytest.")
    tst.add_argument("path", nargs="?", default="tests/replay/", help="Test path (default: tests/replay/).")
    tst.add_argument("--live-llm", action="store_true", help="Re-invoke real LLM calls (costs money).")
    tst.add_argument("--tb", default="short", help="pytest --tb style.")

    # --- ui ---
    ui = sub.add_parser("ui", help="Start the ReplayAI dashboard (self-contained server).")
    ui.add_argument("--port", type=int, default=7373, help="Port (default: 7373).")
    ui.add_argument("--storage", default="./ReplayAI", help="Local storage path (default: ./ReplayAI).")
    ui.add_argument("--cloud", action="store_true", help="Use cloud sync (still serves the local UI).")
    ui.add_argument("--token", default=None, help="Cloud API token.")
    ui.add_argument("--no-browser", action="store_true", help="Don't auto-open the browser.")

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

    # Default to local storage so the recorded session is visible in the
    # dashboard without needing a running cloud API. Users can override with
    # REPLAYAI_STORAGE=cloud or --cloud.
    if args.cloud:
        os.environ.setdefault("REPLAYAI_STORAGE", "both")
    else:
        os.environ.setdefault("REPLAYAI_STORAGE", "local")
    os.environ.setdefault("REPLAYAI_STORAGE_PATH", args.storage)

    # Force config reload so the env vars take effect.
    from . import config as _config
    _config._reload_from_env()

    print(f"[replayai] recording: {script}")
    print(f"  name:      {name}")
    print(f"  project:   {project or '(auto)'}")
    print(f"  framework: {args.framework}")
    print(f"  storage:   {_config.get_config().storage} → {_config.get_config().storage_path}")
    if tags:
        print(f"  tags:      {tags}")

    # Set up the trace context, run the script, then flush on exit.
    try:
        with trace(name, project=project, tags=tags, framework=args.framework):
            # Run the script as __main__ — any record_step calls inside it
            # will be captured.
            runpy.run_path(script, run_name="__main__")
        print(f"[replayai] session recorded — run 'replayai ui' to view it")
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
    """Start the dashboard.

    Launches the bundled self-contained dashboard server (stdlib-only) that
    reads locally-stored sessions and serves a complete UI at the given port.
    No external Next.js app or database is required — sessions recorded with
    ``storage=local`` (or ``both``) appear automatically.
    """
    from . import dashboard_server

    if args.cloud or args.token:
        if args.token:
            os.environ["REPLAYAI_TOKEN"] = args.token
        print(f"[replayai] starting dashboard in cloud mode on port {args.port}")
    else:
        os.environ.setdefault("REPLAYAI_STORAGE", "local")
        os.environ.setdefault("REPLAYAI_STORAGE_PATH", args.storage)
        print(f"[replayai] starting dashboard in local mode on port {args.port}")
        print(f"  storage: {os.path.abspath(args.storage)}")

    return dashboard_server.start_server(
        port=args.port,
        storage_path=args.storage,
        open_browser=not args.no_browser,
    )


if __name__ == "__main__":
    sys.exit(main())
