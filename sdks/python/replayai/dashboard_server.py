"""Self-contained dashboard server — reads local sessions and serves a UI.

Stdlib-only (http.server + json + webbrowser). Launched by ``replayai ui``.

The dashboard UI mirrors the ReplayAI website's Live Demo section: dark theme
with teal primary accent, window chrome (traffic lights + breadcrumbs), 6 stat
cards, sessions sidebar with status dots, and a replay timeline with a
scrubber + step detail (input/output/model/duration).

Endpoints:
  GET /                 → HTML dashboard (single-page app, embedded)
  GET /api/sessions     → JSON list of session summaries
  GET /api/sessions/:id → JSON single session (with steps)
  GET /api/stats        → JSON aggregate stats
  GET /health           → JSON health check

Sessions are read from ``{storage_path}/sessions/*.json`` — the same format
written by ``local_store.save_session()`` when ``storage`` includes ``local``.
"""
from __future__ import annotations

import json
import os
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional
from urllib.parse import urlparse

from . import local_store
from .dashboard_html import DASHBOARD_HTML


class _DashboardHandler(BaseHTTPRequestHandler):
    """HTTP request handler for the dashboard server."""

    # Quiet logging — only log errors, not every request.
    def log_message(self, format: str, *args: Any) -> None:
        pass

    def _send_json(self, data: Any, status: int = 200) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _send_html(self, html: str, status: int = 200) -> None:
        body = html.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/") or "/"

        if path == "/":
            # Inject the port into the breadcrumbs.
            html = DASHBOARD_HTML.replace("__PORT__", str(self.server.server_address[1]))
            self._send_html(html)
            return

        if path == "/health":
            self._send_json({"ok": True, "service": "replayai-dashboard"})
            return

        if path == "/api/stats":
            self._send_json(local_store.get_stats())
            return

        if path == "/api/sessions":
            from urllib.parse import parse_qs

            qs = parse_qs(parsed.query)
            limit = int(qs.get("limit", ["200"])[0])
            offset = int(qs.get("offset", ["0"])[0])
            sessions = local_store.list_sessions(limit=limit, offset=offset)
            self._send_json({"sessions": sessions, "total": len(sessions)})
            return

        if path.startswith("/api/sessions/"):
            sid = path[len("/api/sessions/") :]
            session = local_store.get_session(sid)
            if session is None:
                self._send_json({"error": "not found"}, status=404)
                return
            self._send_json(session)
            return

        self._send_json({"error": "not found"}, status=404)


def start_server(
    port: int = 7373,
    storage_path: Optional[str] = None,
    open_browser: bool = True,
) -> int:
    """Start the dashboard server (blocking).

    Args:
        port: Port to listen on.
        storage_path: Override for the local storage path. If supplied,
            sets ``REPLAYAI_STORAGE_PATH`` so ``local_store`` reads from it.
        open_browser: If True, open the default browser to the dashboard.

    Returns the exit code (0 on clean shutdown, 1 on error).
    """
    if storage_path:
        os.environ["REPLAYAI_STORAGE_PATH"] = storage_path
        # Force config reload (thread-safe).
        from . import config as _config

        _config._reload_from_env()

    # Ensure the storage directory exists.
    from . import config as _config

    cfg = _config.get_config()
    sp = cfg.storage_path
    os.makedirs(os.path.join(sp, "sessions"), exist_ok=True)

    server = ThreadingHTTPServer(("0.0.0.0", port), _DashboardHandler)
    url = f"http://localhost:{port}"

    print(f"[replayai] dashboard server running at {url}")
    print(f"[replayai] storage: {os.path.abspath(sp)}")
    print(f"[replayai] press Ctrl+C to stop")

    if open_browser:
        def _open() -> None:
            import time as _t

            _t.sleep(0.8)
            try:
                webbrowser.open(url)
            except Exception:
                pass

        threading.Thread(target=_open, daemon=True).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[replayai] shutting down…")
        server.shutdown()
        return 0
    except Exception as e:
        print(f"[replayai] error: {e}")
        return 1
    return 0
