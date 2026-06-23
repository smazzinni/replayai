"""Self-contained dashboard server — reads local sessions and serves a UI.

Stdlib-only (http.server + json + webbrowser). Launched by ``replayai ui``
when no external Next.js dashboard is available.

Endpoints:
  GET /                 → HTML dashboard (single-page app, embedded)
  GET /api/sessions     → JSON list of session summaries
  GET /api/sessions/:id → JSON single session (with steps)
  GET /api/stats        → JSON aggregate stats
  GET /health           → JSON health check

The HTML dashboard is a single self-contained page (no external assets) that
fetches from the JSON endpoints and renders a sessions list + step timeline.
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


def _fmt_duration(ms: int) -> str:
    if ms < 1000:
        return f"{ms}ms"
    s = ms / 1000
    if s < 60:
        return f"{s:.1f}s"
    m = int(s // 60)
    return f"{m}m {int(s % 60)}s"


def _fmt_cost(c: float) -> str:
    if c < 0.01:
        return f"${c:.4f}"
    return f"${c:.2f}"


def _fmt_relative(iso_str: str) -> str:
    """Format an ISO timestamp as a relative time string."""
    if not iso_str:
        return ""
    from datetime import datetime, timezone

    try:
        # Handle Z suffix.
        ts = iso_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(ts)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        diff = (now - dt).total_seconds()
        if diff < 60:
            return "just now"
        if diff < 3600:
            return f"{int(diff / 60)}m ago"
        if diff < 86400:
            return f"{int(diff / 3600)}h ago"
        return f"{int(diff / 86400)}d ago"
    except Exception:
        return iso_str


# The dashboard HTML — a self-contained single-page app.
# Uses inline CSS + vanilla JS (no external dependencies).
_DASHBOARD_HTML = r"""<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ReplayAI Dashboard</title>
<style>
  :root {
    --bg: #0a0f0d;
    --bg-card: #11181a;
    --bg-elev: #161f22;
    --border: #1f2a2e;
    --fg: #e8f0ed;
    --muted: #8a9a96;
    --primary: #34d399;
    --primary-dim: #34d39955;
    --rose: #fb7185;
    --amber: #fbbf24;
    --sky: #38bdf8;
    --emerald: #34d399;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--fg);
    font-size: 14px;
    line-height: 1.5;
    min-height: 100vh;
  }
  .mono { font-family: 'SF Mono', Menlo, Consolas, monospace; }

  /* Header */
  header {
    border-bottom: 1px solid var(--border);
    background: rgba(10,15,13,0.85);
    backdrop-filter: blur(12px);
    position: sticky; top: 0; z-index: 50;
    padding: 0 20px;
    height: 52px;
    display: flex; align-items: center; gap: 12px;
  }
  .logo { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; }
  .logo-icon {
    width: 28px; height: 28px; border-radius: 6px;
    background: var(--primary-dim);
    display: flex; align-items: center; justify-content: center;
    color: var(--primary);
  }
  .logo-icon svg { width: 16px; height: 16px; }
  .badge-live {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 11px; padding: 2px 8px; border-radius: 999px;
    background: rgba(52,211,153,0.1); color: var(--emerald);
    border: 1px solid rgba(52,211,153,0.3);
  }
  .badge-live::before {
    content: ''; width: 6px; height: 6px; border-radius: 50%;
    background: var(--emerald); animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .header-spacer { flex: 1; }
  .storage-info { font-size: 12px; color: var(--muted); }

  /* Layout */
  .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
  .stats-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 12px; margin-bottom: 20px;
  }
  .stat-card {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px;
  }
  .stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); }
  .stat-value { font-size: 22px; font-weight: 600; margin-top: 4px; }
  .stat-icon { width: 16px; height: 16px; float: right; opacity: 0.5; }

  /* Main grid */
  .main-grid {
    display: grid; grid-template-columns: 320px 1fr; gap: 16px;
    height: calc(100vh - 52px - 220px); min-height: 500px;
  }
  @media (max-width: 768px) { .main-grid { grid-template-columns: 1fr; } }

  /* Sessions list */
  .sessions-panel {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: 10px; overflow: hidden; display: flex; flex-direction: column;
  }
  .panel-header {
    padding: 12px 14px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px;
  }
  .panel-title { font-size: 13px; font-weight: 600; }
  .search-input {
    flex: 1; background: var(--bg-elev); border: 1px solid var(--border);
    border-radius: 6px; padding: 5px 10px; color: var(--fg); font-size: 12px;
    outline: none;
  }
  .search-input:focus { border-color: var(--primary-dim); }
  .sessions-list { flex: 1; overflow-y: auto; }
  .session-item {
    padding: 10px 14px; border-bottom: 1px solid var(--border);
    cursor: pointer; transition: background 0.15s;
    display: flex; gap: 10px; align-items: flex-start;
  }
  .session-item:hover { background: var(--bg-elev); }
  .session-item.active { background: var(--bg-elev); border-left: 2px solid var(--primary); }
  .session-status {
    width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; flex-shrink: 0;
  }
  .session-status.success { background: var(--emerald); }
  .session-status.failed { background: var(--rose); }
  .session-status.running { background: var(--sky); animation: pulse 1s infinite; }
  .session-name { font-size: 13px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .session-meta { font-size: 11px; color: var(--muted); margin-top: 2px; display: flex; gap: 8px; flex-wrap: wrap; }
  .session-id { font-family: 'SF Mono', Menlo, monospace; font-size: 10px; color: var(--muted); opacity: 0.6; }

  /* Detail panel */
  .detail-panel {
    background: var(--bg-card); border: 1px solid var(--border);
    border-radius: 10px; overflow: hidden; display: flex; flex-direction: column;
  }
  .detail-header { padding: 14px; border-bottom: 1px solid var(--border); }
  .detail-title { font-size: 16px; font-weight: 600; }
  .detail-meta { font-size: 12px; color: var(--muted); margin-top: 4px; display: flex; gap: 12px; flex-wrap: wrap; }
  .detail-tags { margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; }
  .tag {
    font-family: 'SF Mono', Menlo, monospace; font-size: 10px;
    padding: 1px 6px; border-radius: 3px; background: var(--bg-elev);
    color: var(--muted); text-transform: uppercase;
  }
  .timeline { flex: 1; overflow-y: auto; padding: 8px; }
  .step {
    background: var(--bg-elev); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px; margin-bottom: 8px;
  }
  .step-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
  .step-dot { width: 8px; height: 8px; border-radius: 50%; }
  .step-dot.llm_call { background: var(--sky); }
  .step-dot.tool_call { background: var(--amber); }
  .step-dot.retrieval { background: var(--primary); }
  .step-dot.decision { background: #c084fc; }
  .step-dot.error { background: var(--rose); }
  .step-dot { background: var(--muted); }
  .step-name { font-family: 'SF Mono', Menlo, monospace; font-size: 13px; font-weight: 600; }
  .step-type {
    font-size: 10px; text-transform: uppercase; padding: 1px 6px;
    border-radius: 3px; background: var(--bg); color: var(--muted);
  }
  .step-status {
    margin-left: auto; font-size: 10px; padding: 1px 8px;
    border-radius: 999px; border: 1px solid;
  }
  .step-status.success { color: var(--emerald); border-color: rgba(52,211,153,0.3); background: rgba(52,211,153,0.1); }
  .step-status.failed { color: var(--rose); border-color: rgba(251,113,133,0.3); background: rgba(251,113,133,0.1); }
  .step-status.warning { color: var(--amber); border-color: rgba(251,191,36,0.3); background: rgba(251,191,36,0.1); }
  .step-body { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  @media (max-width: 600px) { .step-body { grid-template-columns: 1fr; } }
  .step-field-label { font-size: 10px; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
  .step-field {
    background: var(--bg); border: 1px solid var(--border); border-radius: 5px;
    padding: 8px; font-family: 'SF Mono', Menlo, monospace; font-size: 11px;
    white-space: pre-wrap; word-break: break-word; max-height: 160px; overflow-y: auto;
  }
  .step-footer { margin-top: 8px; font-size: 11px; color: var(--muted); display: flex; gap: 12px; flex-wrap: wrap; }

  /* Empty states */
  .empty {
    flex: 1; display: flex; align-items: center; justify-content: center;
    color: var(--muted); font-size: 13px; text-align: center; padding: 40px;
  }
  .empty-icon { font-size: 32px; margin-bottom: 8px; opacity: 0.3; }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
</style>
</head>
<body>
<header>
  <div class="logo">
    <div class="logo-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 6-6"/>
      </svg>
    </div>
    Replay<span style="color:var(--primary)">AI</span>
  </div>
  <span class="badge-live">LOCAL</span>
  <div class="header-spacer"></div>
  <div class="storage-info" id="storageInfo"></div>
</header>

<div class="container">
  <div class="stats-grid" id="statsGrid">
    <div class="stat-card"><div class="stat-label">Sessions</div><div class="stat-value" id="statTotal">—</div></div>
    <div class="stat-card"><div class="stat-label">Failed</div><div class="stat-value" id="statFailed" style="color:var(--rose)">—</div></div>
    <div class="stat-card"><div class="stat-label">Steps</div><div class="stat-value" id="statSteps">—</div></div>
    <div class="stat-card"><div class="stat-label">Cost</div><div class="stat-value" id="statCost">—</div></div>
    <div class="stat-card"><div class="stat-label">Fail Rate</div><div class="stat-value" id="statFailRate">—</div></div>
  </div>

  <div class="main-grid">
    <div class="sessions-panel">
      <div class="panel-header">
        <span class="panel-title">Sessions</span>
        <input class="search-input" id="searchInput" placeholder="Filter…" />
      </div>
      <div class="sessions-list" id="sessionsList"></div>
    </div>
    <div class="detail-panel">
      <div id="detailContent" class="empty">
        <div>
          <div class="empty-icon">▶</div>
          <div>Select a session to view its timeline</div>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
let allSessions = [];
let selectedId = null;

async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

function fmtDur(ms) {
  if (!ms) return '0ms';
  if (ms < 1000) return ms + 'ms';
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1) + 's';
  return Math.floor(s/60) + 'm ' + Math.floor(s%60) + 's';
}
function fmtCost(c) {
  if (!c) return '$0.00';
  if (c < 0.01) return '$' + c.toFixed(4);
  return '$' + c.toFixed(2);
}
function fmtRel(iso) {
  if (!iso) return '';
  try {
    const dt = new Date(iso);
    const diff = (Date.now() - dt.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff/60) + 'm ago';
    if (diff < 86400) return Math.floor(diff/3600) + 'h ago';
    return Math.floor(diff/86400) + 'd ago';
  } catch { return iso; }
}

async function loadStats() {
  try {
    const s = await fetchJSON('/api/stats');
    document.getElementById('statTotal').textContent = s.total;
    document.getElementById('statFailed').textContent = s.failed;
    document.getElementById('statSteps').textContent = s.steps;
    document.getElementById('statCost').textContent = fmtCost(s.costUsd);
    document.getElementById('statFailRate').textContent = (s.failRate * 100).toFixed(0) + '%';
  } catch (e) { console.error('stats:', e); }
}

async function loadSessions() {
  try {
    const data = await fetchJSON('/api/sessions?limit=200');
    allSessions = data.sessions || [];
    renderSessions();
  } catch (e) {
    console.error('sessions:', e);
    document.getElementById('sessionsList').innerHTML = '<div class="empty">Failed to load sessions</div>';
  }
}

function renderSessions() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const filtered = q ? allSessions.filter(s =>
    (s.name + ' ' + s.agent + ' ' + (s.id||'')).toLowerCase().includes(q)
  ) : allSessions;

  const list = document.getElementById('sessionsList');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty"><div><div class="empty-icon">∅</div><div>No sessions found.<br/>Run <code>replayai record your_script.py</code> to capture one.</div></div></div>';
    return;
  }
  list.innerHTML = filtered.map(s => `
    <div class="session-item ${s.id === selectedId ? 'active' : ''}" onclick="selectSession('${s.id}')">
      <div class="session-status ${s.status}"></div>
      <div style="flex:1;min-width:0">
        <div class="session-name">${esc(s.name)}</div>
        <div class="session-meta">
          <span>${fmtDur(s.durationMs)}</span>
          <span>${fmtCost(s.costUsd)}</span>
          <span>${s.stepCount||0} steps</span>
          <span>${fmtRel(s.startedAt)}</span>
        </div>
        <div class="session-id">${esc(s.id||'')}</div>
      </div>
    </div>
  `).join('');
}

async function selectSession(id) {
  selectedId = id;
  renderSessions();
  const detail = document.getElementById('detailContent');
  detail.innerHTML = '<div class="empty">Loading…</div>';
  try {
    const data = await fetchJSON('/api/sessions/' + id);
    renderDetail(data);
  } catch (e) {
    detail.innerHTML = '<div class="empty">Failed to load session</div>';
  }
}

function renderDetail(s) {
  const steps = s.steps || [];
  const statusColor = s.status === 'failed' ? 'var(--rose)' : 'var(--emerald)';
  const detail = document.getElementById('detailContent');
  detail.className = '';
  detail.style.flex = '1';
  detail.style.overflow = 'hidden';
  detail.style.display = 'flex';
  detail.style.flexDirection = 'column';

  detail.innerHTML = `
    <div class="detail-header">
      <div style="display:flex;align-items:center;gap:8px">
        <div class="session-status ${s.status}" style="margin-top:0"></div>
        <div class="detail-title">${esc(s.name)}</div>
        <span class="step-status ${s.status}" style="text-transform:capitalize">${s.status}</span>
      </div>
      <div class="detail-meta">
        <span class="mono">${esc(s.agent||'')}</span>
        <span>·</span>
        <span>${esc(s.framework||'')}</span>
        <span>·</span>
        <span>${fmtDur(s.durationMs)}</span>
        <span>·</span>
        <span>${(s.tokenTotal||0).toLocaleString()} tok</span>
        <span>·</span>
        <span>${fmtCost(s.costUsd)}</span>
      </div>
      ${s.tags && s.tags.length ? `<div class="detail-tags">${s.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>
    <div class="timeline" id="timeline">
      ${steps.length === 0 ? '<div class="empty">No steps recorded</div>' : steps.map((step, i) => `
        <div class="step">
          <div class="step-header">
            <div class="step-dot ${step.type}"></div>
            <span class="step-type">${esc(step.type||'step')}</span>
            <span class="step-name">${esc(step.name)}</span>
            <span class="step-status ${step.status}">${step.status}</span>
          </div>
          <div class="step-body">
            <div>
              <div class="step-field-label">Input</div>
              <div class="step-field">${esc(step.input || '(empty)')}</div>
            </div>
            <div>
              <div class="step-field-label">Output</div>
              <div class="step-field">${esc(step.output || '(empty)')}</div>
            </div>
          </div>
          <div class="step-footer">
            ${step.model ? `<span class="mono">${esc(step.model)}</span>` : ''}
            <span>offset ${fmtDur(step.offsetMs||step.t||0)}</span>
            <span>dur ${fmtDur(step.durationMs||0)}</span>
            ${step.tokensIn ? `<span>${step.tokensIn} in</span>` : ''}
            ${step.tokensOut ? `<span>${step.tokensOut} out</span>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

// Init
document.getElementById('searchInput').addEventListener('input', renderSessions);
loadStats();
loadSessions();

// Auto-refresh every 5s (so newly recorded sessions appear)
setInterval(() => { loadStats(); loadSessions(); }, 5000);
</script>
</body>
</html>"""


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
            self._send_html(_DASHBOARD_HTML)
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
        # Force config reload.
        from . import config as _config

        _config._config = _config._load_from_env()

    # Ensure the storage directory exists.
    from . import config as _config

    cfg = _config.get_config()
    sp = cfg.storage_path
    os.makedirs(os.path.join(sp, "sessions"), exist_ok=True)

    server = ThreadingHTTPServer(
        ("0.0.0.0", port), _DashboardHandler
    )
    url = f"http://localhost:{port}"

    print(f"[replayai] dashboard server running at {url}")
    print(f"[replayai] storage: {os.path.abspath(sp)}")
    print(f"[replayai] press Ctrl+C to stop")

    if open_browser:
        # Open the browser after a short delay so the server is ready.
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
