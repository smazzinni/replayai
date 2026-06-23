// ReplayAI TypeScript SDK — self-contained dashboard server.
//
// Reads locally-stored sessions and serves a complete UI. Node built-ins
// only (http + fs + child_process for opening the browser). Launched by
// `replayai ui` from the CLI bin.
//
// The dashboard UI mirrors the ReplayAI website's Live Demo section: dark
// theme with teal primary accent, window chrome, 6 stat cards, sessions
// sidebar, and a replay timeline with scrubber + step detail.
//
// Endpoints:
//   GET /                 → HTML dashboard (single-page app, embedded)
//   GET /api/sessions     → JSON list of session summaries
//   GET /api/sessions/:id → JSON single session (with steps)
//   GET /api/stats        → JSON aggregate stats
//   GET /health           → JSON health check
import { createServer } from "node:http";
import { exec } from "node:child_process";
import { join, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { getConfig, configure } from "./config.js";
import { listSessions, getSession, getStats, countSessions } from "./local-store.js";
const SDK_VERSION = "0.7.3";
// The dashboard HTML — a self-contained single-page app matching the
// ReplayAI website's Live Demo design. Identical to the Python SDK's
// dashboard_html.py.
const DASHBOARD_HTML = `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ReplayAI Dashboard</title>
<style>
  :root {
    --bg: #0a0f0d;
    --bg-card: rgba(17,24,26,0.6);
    --bg-elev: #161f22;
    --bg-input: rgba(10,15,13,0.4);
    --border: rgba(31,42,46,0.6);
    --border-strong: #1f2a2e;
    --fg: #e8f0ed;
    --fg-dim: #b8c5c0;
    --muted: #8a9a96;
    --muted-dim: #5a6a66;
    --primary: #34d399;
    --primary-dim: rgba(52,211,153,0.15);
    --primary-glow: rgba(52,211,153,0.25);
    --rose: #fb7185;
    --rose-dim: rgba(251,113,133,0.1);
    --amber: #fbbf24;
    --amber-dim: rgba(251,191,36,0.1);
    --sky: #38bdf8;
    --sky-dim: rgba(56,189,248,0.1);
    --violet: #c084fc;
    --violet-dim: rgba(192,132,252,0.1);
    --emerald: #34d399;
    --emerald-dim: rgba(52,211,153,0.1);
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: var(--bg);
    color: var(--fg);
    font-size: 14px;
    line-height: 1.5;
    overflow: hidden;
  }
  .mono { font-family: 'SF Mono', Menlo, Consolas, 'Courier New', monospace; }

  .app { display: flex; flex-direction: column; height: 100vh; }

  .top-header {
    height: 48px;
    border-bottom: 1px solid var(--border);
    background: rgba(10,15,13,0.8);
    backdrop-filter: blur(12px);
    display: flex; align-items: center; gap: 12px;
    padding: 0 16px;
    flex-shrink: 0;
  }
  .logo { display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 15px; }
  .logo-icon {
    width: 26px; height: 26px; border-radius: 6px;
    background: var(--primary-dim);
    display: flex; align-items: center; justify-content: center;
    color: var(--primary);
    border: 1px solid rgba(52,211,153,0.3);
  }
  .logo-icon svg { width: 14px; height: 14px; }
  .badge-live {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 10.5px; padding: 2px 8px; border-radius: 999px;
    background: var(--emerald-dim); color: var(--emerald);
    border: 1px solid rgba(52,211,153,0.3);
  }
  .badge-live::before {
    content: ''; width: 6px; height: 6px; border-radius: 50%;
    background: var(--emerald); animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .header-spacer { flex: 1; }
  .storage-info {
    font-size: 11.5px; color: var(--muted);
    display: flex; align-items: center; gap: 6px;
  }
  .storage-info code {
    font-family: 'SF Mono', Menlo, monospace; font-size: 11px;
    background: var(--bg-elev); padding: 2px 6px; border-radius: 4px;
    color: var(--fg-dim);
  }

  .dashboard-wrap {
    flex: 1; padding: 12px; overflow: hidden;
    display: flex; flex-direction: column;
  }
  .dashboard {
    flex: 1;
    border-radius: 14px;
    border: 1px solid var(--border);
    background: var(--bg-card);
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    backdrop-filter: blur(12px);
    overflow: hidden;
    display: flex; flex-direction: column;
  }

  .window-chrome {
    display: flex; align-items: center; gap: 8px;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    background: rgba(10,15,13,0.4);
    flex-shrink: 0;
  }
  .traffic-lights { display: flex; gap: 6px; }
  .traffic-lights span {
    width: 11px; height: 11px; border-radius: 50%;
    opacity: 0.7; transition: opacity 0.15s;
  }
  .traffic-lights span:nth-child(1) { background: #ff5f57; }
  .traffic-lights span:nth-child(2) { background: #febc2e; }
  .traffic-lights span:nth-child(3) { background: #28c840; }
  .traffic-lights:hover span { opacity: 1; }
  .breadcrumbs {
    display: flex; align-items: center; gap: 6px;
    font-family: 'SF Mono', Menlo, monospace; font-size: 11.5px;
    color: var(--muted); margin-left: 8px;
  }
  .breadcrumbs .bc-active { color: var(--primary); }
  .breadcrumbs .sep { opacity: 0.4; }
  .chrome-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .chrome-btn {
    height: 28px; padding: 0 10px;
    border-radius: 6px; border: 1px solid var(--border);
    background: rgba(10,15,13,0.4); color: var(--muted);
    font-size: 11.5px; cursor: pointer; transition: all 0.15s;
    display: inline-flex; align-items: center; gap: 6px;
  }
  .chrome-btn:hover { border-color: rgba(52,211,153,0.4); color: var(--fg); }

  .tabs {
    display: flex; align-items: center; gap: 2px;
    padding: 0 8px;
    border-bottom: 1px solid var(--border);
    background: rgba(10,15,13,0.3);
    flex-shrink: 0;
  }
  .tab {
    padding: 10px 14px;
    font-size: 12.5px; font-weight: 500;
    color: var(--muted); cursor: pointer; transition: color 0.15s;
    border: none; background: none;
    display: inline-flex; align-items: center; gap: 6px;
    position: relative;
  }
  .tab:hover { color: var(--fg-dim); }
  .tab.active { color: var(--fg); }
  .tab.active::after {
    content: ''; position: absolute; bottom: -1px; left: 8px; right: 8px;
    height: 2px; background: var(--primary); border-radius: 1px;
  }
  .tab svg { width: 14px; height: 14px; }
  .tab-desc { margin-left: auto; font-size: 10.5px; color: var(--muted-dim); padding-right: 12px; }

  .stats-strip {
    display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
    background: rgba(10,15,13,0.2);
    flex-shrink: 0;
  }
  @media (max-width: 900px) { .stats-strip { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 500px) { .stats-strip { grid-template-columns: repeat(2, 1fr); } }
  .stat-card {
    background: var(--bg-input);
    border: 1px solid var(--border);
    border-radius: 8px; padding: 10px 12px;
    display: flex; align-items: center; gap: 10px;
    transition: border-color 0.15s;
  }
  .stat-card:hover { border-color: rgba(52,211,153,0.3); }
  .stat-icon {
    width: 30px; height: 30px; border-radius: 7px;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  .stat-icon svg { width: 15px; height: 15px; }
  .stat-icon.primary { background: var(--primary-dim); color: var(--primary); }
  .stat-icon.rose { background: var(--rose-dim); color: var(--rose); }
  .stat-icon.sky { background: var(--sky-dim); color: var(--sky); }
  .stat-icon.amber { background: var(--amber-dim); color: var(--amber); }
  .stat-icon.violet { background: var(--violet-dim); color: var(--violet); }
  .stat-icon.emerald { background: var(--emerald-dim); color: var(--emerald); }
  .stat-body { min-width: 0; }
  .stat-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--muted); white-space: nowrap;
  }
  .stat-value { font-size: 18px; font-weight: 600; line-height: 1.2; margin-top: 1px; }

  .main-panel {
    flex: 1; display: grid; grid-template-columns: 280px 1fr;
    overflow: hidden; min-height: 0;
  }
  @media (max-width: 768px) { .main-panel { grid-template-columns: 1fr; } }

  .sidebar {
    border-right: 1px solid var(--border);
    display: flex; flex-direction: column;
    overflow: hidden;
  }
  .sidebar-header {
    padding: 10px 12px; border-bottom: 1px solid var(--border);
    display: flex; align-items: center; gap: 8px;
    flex-shrink: 0;
  }
  .sidebar-title { font-size: 12px; font-weight: 600; color: var(--fg-dim); }
  .sidebar-count {
    font-size: 10px; padding: 1px 6px; border-radius: 999px;
    background: var(--bg-elev); color: var(--muted);
  }
  .search-wrap { flex: 1; position: relative; }
  .search-wrap svg {
    position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
    width: 13px; height: 13px; color: var(--muted-dim);
  }
  .search-input {
    width: 100%; height: 28px;
    background: var(--bg-input); border: 1px solid var(--border);
    border-radius: 6px; padding: 0 8px 0 26px;
    color: var(--fg); font-size: 12px; outline: none;
    transition: border-color 0.15s;
  }
  .search-input:focus { border-color: rgba(52,211,153,0.4); }
  .sessions-list { flex: 1; overflow-y: auto; }
  .session-item {
    padding: 10px 12px; border-bottom: 1px solid var(--border);
    cursor: pointer; transition: background 0.12s;
    display: flex; gap: 10px; align-items: flex-start;
    position: relative;
  }
  .session-item:hover { background: rgba(22,31,34,0.5); }
  .session-item.active { background: rgba(22,31,34,0.7); }
  .session-item.active::before {
    content: ''; position: absolute; left: 0; top: 0; bottom: 0;
    width: 2px; background: var(--primary);
  }
  .session-dot {
    width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0;
  }
  .session-dot.success { background: var(--emerald); }
  .session-dot.failed { background: var(--rose); }
  .session-dot.running { background: var(--sky); animation: pulse 1s infinite; }
  .session-info { flex: 1; min-width: 0; }
  .session-name {
    font-size: 12.5px; font-weight: 500; color: var(--fg);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .session-meta {
    font-size: 10.5px; color: var(--muted); margin-top: 2px;
    display: flex; gap: 6px; flex-wrap: wrap; align-items: center;
  }
  .session-meta .sep { opacity: 0.4; }
  .session-id {
    font-family: 'SF Mono', Menlo, monospace; font-size: 10px;
    color: var(--muted-dim); margin-top: 2px;
  }

  .detail { display: flex; flex-direction: column; overflow: hidden; }
  .detail-header {
    padding: 12px 16px; border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .detail-status-row { display: flex; align-items: center; gap: 8px; }
  .status-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 10.5px; padding: 2px 8px; border-radius: 999px;
    border: 1px solid; font-weight: 500;
  }
  .status-badge.success { color: var(--emerald); border-color: rgba(52,211,153,0.3); background: var(--emerald-dim); }
  .status-badge.failed { color: var(--rose); border-color: rgba(251,113,133,0.3); background: var(--rose-dim); }
  .status-badge.running { color: var(--sky); border-color: rgba(56,189,248,0.3); background: var(--sky-dim); }
  .status-badge .dot { width: 6px; height: 6px; border-radius: 50%; }
  .status-badge.success .dot { background: var(--emerald); }
  .status-badge.failed .dot { background: var(--rose); }
  .status-badge.running .dot { background: var(--sky); }
  .detail-id { font-family: 'SF Mono', Menlo, monospace; font-size: 11px; color: var(--muted); }
  .detail-title { font-size: 15px; font-weight: 600; margin-top: 6px; }
  .detail-meta {
    font-size: 11px; color: var(--muted); margin-top: 4px;
    display: flex; gap: 10px; flex-wrap: wrap; align-items: center;
  }
  .detail-meta .sep { opacity: 0.4; }
  .detail-tags { margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; }
  .tag {
    font-family: 'SF Mono', Menlo, monospace; font-size: 9.5px;
    padding: 1px 6px; border-radius: 3px; background: var(--bg-elev);
    color: var(--muted); text-transform: uppercase; letter-spacing: 0.3px;
  }

  .scrubber {
    padding: 10px 16px; border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .scrubber-meta {
    display: flex; justify-content: space-between;
    font-size: 10.5px; color: var(--muted); margin-bottom: 6px;
    font-family: 'SF Mono', Menlo, monospace;
  }
  .scrubber-bar {
    display: flex; gap: 1px; height: 28px;
    border-radius: 6px; overflow: hidden;
    border: 1px solid var(--border); padding: 1px;
    background: rgba(10,15,13,0.4);
  }
  .seg {
    flex: 1; min-width: 4px; border-radius: 3px;
    cursor: pointer; transition: opacity 0.12s;
    border: none; position: relative;
  }
  .seg:hover { opacity: 0.8; }
  .seg.active { box-shadow: 0 0 0 2px var(--primary), 0 0 0 3px var(--bg); }
  .seg.llm_call { background: var(--sky); }
  .seg.tool_call { background: var(--amber); }
  .seg.retrieval { background: var(--emerald); }
  .seg.decision { background: var(--violet); }
  .seg.error { background: var(--rose); }
  .seg.default { background: var(--muted-dim); }
  .scrubber-controls {
    display: flex; align-items: center; gap: 6px; margin-top: 8px;
  }
  .ctrl-btn {
    height: 30px; min-width: 30px; padding: 0 8px;
    border-radius: 6px; border: 1px solid var(--border);
    background: rgba(10,15,13,0.4); color: var(--muted);
    cursor: pointer; transition: all 0.15s;
    display: inline-flex; align-items: center; justify-content: center; gap: 5px;
    font-size: 12px;
  }
  .ctrl-btn:hover { color: var(--fg); border-color: rgba(52,211,153,0.3); }
  .ctrl-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .ctrl-btn.primary {
    background: var(--primary); color: #0a0f0d; border-color: var(--primary);
    font-weight: 600;
  }
  .ctrl-btn.primary:hover { background: #2bc289; }
  .ctrl-btn svg { width: 14px; height: 14px; }

  .step-detail { flex: 1; overflow-y: auto; padding: 14px 16px; }
  .step-header-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .step-type-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 10.5px; padding: 2px 8px; border-radius: 5px;
    border: 1px solid var(--border); background: var(--bg-input);
    font-weight: 500;
  }
  .step-type-badge .dot { width: 6px; height: 6px; border-radius: 50%; }
  .step-type-badge .dot.llm_call { background: var(--sky); }
  .step-type-badge .dot.tool_call { background: var(--amber); }
  .step-type-badge .dot.retrieval { background: var(--emerald); }
  .step-type-badge .dot.decision { background: var(--violet); }
  .step-type-badge .dot.error { background: var(--rose); }
  .step-type-badge .dot.default { background: var(--muted); }
  .step-name { font-family: 'SF Mono', Menlo, monospace; font-size: 13px; font-weight: 600; }
  .step-status {
    margin-left: auto; font-size: 10px; padding: 1px 8px;
    border-radius: 999px; border: 1px solid; font-weight: 500;
  }
  .step-status.success { color: var(--emerald); border-color: rgba(52,211,153,0.3); background: var(--emerald-dim); }
  .step-status.failed { color: var(--rose); border-color: rgba(251,113,133,0.3); background: var(--rose-dim); }
  .step-status.warning { color: var(--amber); border-color: rgba(251,191,36,0.3); background: var(--amber-dim); }

  .step-meta-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 6px; margin-bottom: 12px;
  }
  .meta-box {
    background: var(--bg-input); border: 1px solid var(--border);
    border-radius: 6px; padding: 6px 9px;
  }
  .meta-label {
    font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--muted-dim); opacity: 0.8;
  }
  .meta-value { font-family: 'SF Mono', Menlo, monospace; font-size: 11.5px; color: var(--fg-dim); margin-top: 1px; }

  .step-io {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
  }
  @media (max-width: 700px) { .step-io { grid-template-columns: 1fr; } }
  .io-block .io-label {
    font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px;
    color: var(--muted); margin-bottom: 4px;
    display: flex; align-items: center; gap: 5px;
  }
  .io-label svg { width: 11px; height: 11px; }
  .io-content {
    background: rgba(0,0,0,0.3); border: 1px solid var(--border);
    border-radius: 6px; padding: 10px;
    font-family: 'SF Mono', Menlo, monospace; font-size: 11.5px;
    white-space: pre-wrap; word-break: break-word;
    max-height: 240px; overflow-y: auto;
    color: var(--fg-dim); line-height: 1.6;
  }
  .io-content.failed { border-color: rgba(251,113,133,0.3); background: rgba(251,113,133,0.05); }

  .empty-state {
    flex: 1; display: flex; align-items: center; justify-content: center;
    color: var(--muted); font-size: 13px; text-align: center; padding: 40px;
  }
  .empty-icon { font-size: 36px; margin-bottom: 10px; opacity: 0.25; }
  .empty-state code {
    font-family: 'SF Mono', Menlo, monospace; font-size: 12px;
    background: var(--bg-elev); padding: 2px 6px; border-radius: 4px;
    color: var(--primary);
  }

  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
</style>
</head>
<body>
<div class="app">
  <header class="top-header">
    <div class="logo">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3v18h18"/><polyline points="7 14 11 10 15 14 21 8"/>
        </svg>
      </div>
      Replay<span style="color:var(--primary)">AI</span>
    </div>
    <span class="badge-live">LOCAL</span>
    <div class="header-spacer"></div>
    <div class="storage-info">Storage: <code id="storagePath">./ReplayAI</code></div>
  </header>

  <div class="dashboard-wrap">
    <div class="dashboard">
      <div class="window-chrome">
        <div class="traffic-lights"><span></span><span></span><span></span></div>
        <div class="breadcrumbs">
          <span class="bc-active">replayai</span>
          <span class="sep">/</span>
          <span>localhost:__PORT__</span>
          <span class="sep">/</span>
          <span>sessions</span>
        </div>
        <div class="chrome-right">
          <button class="chrome-btn" id="refreshBtn" title="Refresh">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M3 21v-5h5"/></svg>
            Refresh
          </button>
        </div>
      </div>

      <div class="tabs">
        <button class="tab active">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Replay
        </button>
        <div class="tab-desc">Scrub through every step of a recorded run</div>
      </div>

      <div class="stats-strip" id="statsStrip">
        <div class="stat-card">
          <div class="stat-icon primary"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3h18v18H3z"/><path d="M9 9h6v6H9z"/></svg></div>
          <div class="stat-body"><div class="stat-label">Sessions</div><div class="stat-value" id="statTotal">—</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon rose"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
          <div class="stat-body"><div class="stat-label">Failed</div><div class="stat-value" id="statFailed" style="color:var(--rose)">—</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon sky"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg></div>
          <div class="stat-body"><div class="stat-label">Steps</div><div class="stat-value" id="statSteps">—</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon amber"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/></svg></div>
          <div class="stat-body"><div class="stat-label">Cost</div><div class="stat-value" id="statCost">—</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon violet"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg></div>
          <div class="stat-body"><div class="stat-label">Fail Rate</div><div class="stat-value" id="statFailRate">—</div></div>
        </div>
        <div class="stat-card">
          <div class="stat-icon emerald"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div>
          <div class="stat-body"><div class="stat-label">Avg Run</div><div class="stat-value" id="statAvgDur">—</div></div>
        </div>
      </div>

      <div class="main-panel">
        <div class="sidebar">
          <div class="sidebar-header">
            <span class="sidebar-title">Sessions</span>
            <span class="sidebar-count" id="sessionCount">0</span>
            <div class="search-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              <input class="search-input" id="searchInput" placeholder="Filter sessions…" />
            </div>
          </div>
          <div class="sessions-list" id="sessionsList"></div>
        </div>

        <div class="detail" id="detailPanel">
          <div class="empty-state">
            <div>
              <div class="empty-icon">▶</div>
              <div>Select a session to replay</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
let allSessions = [];
let selectedId = null;
let currentSession = null;
let stepIndex = 0;

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
function fmtOffset(ms) {
  if (!ms) return '+0ms';
  if (ms < 1000) return '+' + ms + 'ms';
  return '+' + (ms/1000).toFixed(1) + 's';
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
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
}

async function loadStats() {
  try {
    const s = await fetchJSON('/api/stats');
    document.getElementById('statTotal').textContent = s.total;
    document.getElementById('statFailed').textContent = s.failed;
    document.getElementById('statSteps').textContent = s.steps;
    document.getElementById('statCost').textContent = fmtCost(s.costUsd);
    document.getElementById('statFailRate').textContent = (s.failRate * 100).toFixed(0) + '%';
    document.getElementById('statAvgDur').textContent = s.avgDurationMs ? fmtDur(s.avgDurationMs) : '—';
  } catch (e) { console.error('stats:', e); }
}

async function loadSessions() {
  try {
    const data = await fetchJSON('/api/sessions?limit=200');
    allSessions = data.sessions || [];
    document.getElementById('sessionCount').textContent = allSessions.length;
    renderSessions();
    if (!selectedId && allSessions.length > 0) {
      const firstFailed = allSessions.find(s => s.status === 'failed');
      selectSession((firstFailed || allSessions[0]).id);
    }
  } catch (e) {
    console.error('sessions:', e);
    document.getElementById('sessionsList').innerHTML = '<div class="empty-state"><div><div class="empty-icon">∅</div><div>No sessions found.<br/>Record one with <code>withTrace()</code> in your code.</div></div></div>';
  }
}

function renderSessions() {
  const q = document.getElementById('searchInput').value.toLowerCase().trim();
  const filtered = q ? allSessions.filter(s =>
    (s.name + ' ' + s.agent + ' ' + (s.id||'') + ' ' + (s.tags||[]).join(' ')).toLowerCase().includes(q)
  ) : allSessions;

  const list = document.getElementById('sessionsList');
  if (filtered.length === 0) {
    list.innerHTML = '<div class="empty-state"><div><div class="empty-icon">∅</div><div>' + (q ? 'No sessions match your filter.' : 'No sessions yet.<br/>Record one to see it here.') + '</div></div></div>';
    return;
  }
  list.innerHTML = filtered.map(s => '<div class="session-item ' + (s.id === selectedId ? 'active' : '') + '" onclick="selectSession(\\'' + esc(s.id) + '\\')"><div class="session-dot ' + s.status + '"></div><div class="session-info"><div class="session-name">' + esc(s.name) + '</div><div class="session-meta"><span>' + fmtDur(s.durationMs) + '</span><span class="sep">·</span><span>' + fmtCost(s.costUsd) + '</span><span class="sep">·</span><span>' + (s.stepCount||0) + ' steps</span><span class="sep">·</span><span>' + fmtRel(s.startedAt) + '</span></div><div class="session-id">' + esc(s.id||'') + '</div></div></div>').join('');
}

async function selectSession(id) {
  selectedId = id;
  renderSessions();
  const detail = document.getElementById('detailPanel');
  detail.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    const data = await fetchJSON('/api/sessions/' + encodeURIComponent(id));
    currentSession = data;
    stepIndex = 0;
    renderDetail();
  } catch (e) {
    detail.innerHTML = '<div class="empty-state">Failed to load session.</div>';
  }
}

function renderDetail() {
  if (!currentSession) return;
  const s = currentSession;
  const steps = s.steps || [];
  const detail = document.getElementById('detailPanel');
  const statusClass = s.status || 'success';
  const statusLabel = (s.status || 'success').charAt(0).toUpperCase() + (s.status || 'success').slice(1);

  detail.innerHTML = '<div class="detail-header"><div class="detail-status-row"><span class="status-badge ' + statusClass + '"><span class="dot"></span>' + statusLabel + '</span><span class="detail-id">' + esc(s.id||'') + '</span></div><div class="detail-title">' + esc(s.name) + '</div><div class="detail-meta"><span class="mono">' + esc(s.agent||'') + '</span><span class="sep">·</span><span>' + esc(s.framework||'') + '</span><span class="sep">·</span><span>' + fmtDur(s.durationMs) + '</span><span class="sep">·</span><span>' + (s.tokenTotal||0).toLocaleString() + ' tok</span><span class="sep">·</span><span>' + fmtCost(s.costUsd) + '</span></div>' + (s.tags && s.tags.length ? '<div class="detail-tags">' + s.tags.map(t=>'<span class="tag">' + esc(t) + '</span>').join('') + '</div>' : '') + '</div>' + (steps.length > 0 ? '<div class="scrubber"><div class="scrubber-meta"><span>Step ' + (stepIndex + 1) + ' / ' + steps.length + '</span><span>' + fmtOffset(steps[stepIndex]?.offsetMs ?? steps[stepIndex]?.t ?? 0) + ' · ' + fmtDur(steps[stepIndex]?.durationMs ?? 0) + '</span></div><div class="scrubber-bar">' + steps.map((st, i) => '<button class="seg ' + (st.type||'default') + ' ' + (i===stepIndex?'active':'') + '" onclick="stepTo(' + i + ')" title="' + esc(st.name) + ' · ' + fmtDur(st.durationMs) + '"></button>').join('') + '</div><div class="scrubber-controls"><button class="ctrl-btn" onclick="stepTo(0)" title="Restart"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></button><button class="ctrl-btn" onclick="stepTo(' + (stepIndex - 1) + ')" ' + (stepIndex === 0 ? 'disabled' : '') + ' title="Previous"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg></button><button class="ctrl-btn primary" onclick="stepTo(' + (stepIndex + 1) + ')" ' + (stepIndex >= steps.length - 1 ? 'disabled' : '') + '>Next step <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></button><button class="ctrl-btn" onclick="stepTo(' + (steps.length - 1) + ')" ' + (stepIndex >= steps.length - 1 ? 'disabled' : '') + ' title="Last"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg></button></div></div><div class="step-detail" id="stepDetail"></div>' : '<div class="empty-state"><div><div class="empty-icon">∅</div><div>No steps recorded in this session.</div></div></div>');

  if (steps.length > 0) renderStep();
}

function renderStep() {
  if (!currentSession) return;
  const steps = currentSession.steps || [];
  const step = steps[stepIndex];
  if (!step) return;
  const type = step.type || 'default';
  const status = step.status || 'success';
  const container = document.getElementById('stepDetail');
  if (!container) return;
  container.innerHTML = '<div class="step-header-row"><span class="step-type-badge"><span class="dot ' + type + '"></span>' + esc(type) + '</span><span class="step-name">' + esc(step.name) + '</span><span class="step-status ' + status + '">' + status + '</span></div><div class="step-meta-grid">' + (step.model ? '<div class="meta-box"><div class="meta-label">Model</div><div class="meta-value">' + esc(step.model) + '</div></div>' : '') + '<div class="meta-box"><div class="meta-label">Duration</div><div class="meta-value">' + fmtDur(step.durationMs || 0) + '</div></div>' + (step.tokensIn != null ? '<div class="meta-box"><div class="meta-label">Tokens</div><div class="meta-value">' + (step.tokensIn||0) + ' → ' + (step.tokensOut||0) + '</div></div>' : '') + '<div class="meta-box"><div class="meta-label">Offset</div><div class="meta-value">' + fmtOffset(step.offsetMs ?? step.t ?? 0) + '</div></div></div><div class="step-io"><div class="io-block"><div class="io-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg> Input</div><div class="io-content">' + esc(step.input || '(empty)') + '</div></div><div class="io-block"><div class="io-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 17 14 11 20 5"/><line x1="4" y1="19" x2="12" y2="19"/></svg> Output</div><div class="io-content ' + (status === 'failed' ? 'failed' : '') + '">' + esc(step.output || '(empty)') + '</div></div></div>';
}

function stepTo(i) {
  if (!currentSession) return;
  const steps = currentSession.steps || [];
  stepIndex = Math.max(0, Math.min(steps.length - 1, i));
  renderDetail();
}

document.getElementById('searchInput').addEventListener('input', renderSessions);
document.getElementById('refreshBtn').addEventListener('click', () => { loadStats(); loadSessions(); });
loadStats();
loadSessions();
setInterval(() => { loadStats(); loadSessions(); }, 5000);
</script>
</body>
</html>`;
function sendJSON(res, data, status = 200, port) {
    const body = JSON.stringify(data);
    const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store",
    };
    // Restrict CORS to localhost for security (prevents other websites
    // on the network from reading recorded session data).
    if (port) {
        headers["Access-Control-Allow-Origin"] = `http://localhost:${port}`;
    }
    res.writeHead(status, headers);
    res.end(body);
}
function sendHTML(res, html, status = 200) {
    const body = Buffer.from(html, "utf8");
    res.writeHead(status, {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Length": body.length,
        "Cache-Control": "no-store",
    });
    res.end(body);
}
function openBrowser(url) {
    const cmd = process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
            ? "start"
            : "xdg-open";
    try {
        exec(`${cmd} ${url}`, () => {
            /* ignore errors */
        });
    }
    catch {
        /* ignore */
    }
}
/** Start the dashboard server (blocking). Returns exit code. */
export function startServer(opts) {
    const port = opts.port ?? 7373;
    const storagePath = opts.storagePath;
    const shouldOpen = opts.openBrowser ?? true;
    if (storagePath) {
        configure({ storage: "local", storagePath });
    }
    const cfg = getConfig();
    const absStorage = resolve(cfg.storagePath);
    mkdirSync(join(absStorage, "sessions"), { recursive: true });
    const server = createServer((req, res) => {
        const url = new URL(req.url || "/", `http://localhost:${port}`);
        const path = url.pathname.replace(/\/$/, "") || "/";
        if (path === "/") {
            const html = DASHBOARD_HTML.replace("__PORT__", String(port));
            sendHTML(res, html);
            return;
        }
        if (path === "/health") {
            sendJSON(res, { ok: true, service: "replayai-dashboard", version: SDK_VERSION }, 200, port);
            return;
        }
        if (path === "/api/stats") {
            sendJSON(res, getStats(), 200, port);
            return;
        }
        if (path === "/api/sessions") {
            const limitRaw = parseInt(url.searchParams.get("limit") || "200", 10);
            const offsetRaw = parseInt(url.searchParams.get("offset") || "0", 10);
            const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 200;
            const offset = Number.isFinite(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;
            const sessions = listSessions(limit, offset).map((s) => {
                const { steps, ...rest } = s;
                return { ...rest, stepCount: steps?.length ?? 0 };
            });
            const total = countSessions();
            sendJSON(res, { sessions, total, hasMore: offset + limit < total }, 200, port);
            return;
        }
        if (path.startsWith("/api/sessions/")) {
            const sid = decodeURIComponent(path.slice("/api/sessions/".length));
            const session = getSession(sid);
            if (!session) {
                sendJSON(res, { error: "not found" }, 404, port);
                return;
            }
            sendJSON(res, session, 200, port);
            return;
        }
        sendJSON(res, { error: "not found" }, 404, port);
    });
    server.listen(port, "127.0.0.1", () => {
        const url = `http://localhost:${port}`;
        console.log(`[replayai] dashboard server running at ${url}`);
        console.log(`[replayai] storage: ${absStorage}`);
        console.log(`[replayai] press Ctrl+C to stop`);
        if (shouldOpen) {
            setTimeout(() => openBrowser(url), 800);
        }
    });
    const shutdown = () => {
        console.log("\n[replayai] shutting down…");
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 2000).unref();
    };
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
    return 0;
}
//# sourceMappingURL=dashboard-server.js.map