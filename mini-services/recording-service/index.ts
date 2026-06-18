// replayai-recording-service
//
// A tiny realtime broadcast relay for the ReplayAI project.
//
// - socket.io server on port 3003 (hardcoded), path "/" (required by Caddy).
// - HTTP `POST /broadcast` endpoint (same http server) that fan-outs events to
//   all connected dashboard clients via io.emit().
// - Any other non-socket.io HTTP request returns a small health JSON payload.
//
// The main Next.js app (port 3000) calls POST /broadcast when sessions are
// created/updated/deleted so connected dashboards update live without polling.
//
// --------------------------------------------------------------------------- //
// IMPORTANT implementation note on path: "/"
// --------------------------------------------------------------------------- //
// engine.io's attach() installs a single 'request' listener on the http server
// and routes via a naive prefix check: `path === req.url.slice(0, path.length)`.
// With path "/" this matches EVERY request (every URL starts with "/"), so
// engine.io would swallow our /broadcast and /health routes and return
// {"code":0,"message":"Transport unknown"} for them.
//
// To host both socket.io AND our HTTP routes on the same port, we capture
// engine.io's listener right after the Server is constructed, remove it, and
// install our own smart router that:
//   - handles POST /broadcast itself,
//   - delegates only pathname === "/" to engine.io (real socket.io traffic),
//   - responds with health JSON for anything else.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server } from "socket.io";

const PORT = 3003;
const HOST = "0.0.0.0";
const BROADCAST_TOKEN = process.env.REPLAYAI_BROADCAST_TOKEN; // optional

// ---------------------------------------------------------------------------
// HTTP server + socket.io
// ---------------------------------------------------------------------------

const httpServer = createServer();

const io = new Server(httpServer, {
  // CRITICAL: Caddy forwards on this path. Do not change.
  path: "/",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  // We do not serve the socket.io client JS from this server; the dashboard
  // bundles socket.io-client from npm. Disabling avoids an extra route.
  serveClient: false,
});

// Capture engine.io's single request listener (added during attach above) and
// replace it with a smart router. This must happen BEFORE httpServer.listen().
const engineRequestListeners = httpServer.listeners("request").slice();
httpServer.removeAllListeners("request");

httpServer.on("request", (req, res) => {
  handleHttpRequest(req, res, engineRequestListeners).catch((err) => {
    console.error("[recording-service] request handler error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "internal error" }));
    }
  });
});

// ---------------------------------------------------------------------------
// HTTP request handling
// ---------------------------------------------------------------------------

async function handleHttpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  delegateListeners: Array<(req: IncomingMessage, res: ServerResponse) => void>,
) {
  let pathname: string;
  try {
    pathname = new URL(req.url || "/", "http://localhost").pathname;
  } catch {
    pathname = req.url || "/";
  }

  // POST /broadcast — fan-out an event to all connected clients.
  if (pathname === "/broadcast" && req.method === "POST") {
    return handleBroadcast(req, res);
  }

  // pathname === "/" is owned by socket.io / engine.io (handshake, polling,
  // websocket upgrade). Delegate to engine.io's captured listener(s).
  if (pathname === "/") {
    for (const listener of delegateListeners) {
      listener.call(httpServer, req, res);
    }
    return;
  }

  // Anything else: health/info JSON (used by health checks).
  return respondJson(res, 200, {
    service: "replayai-recording-service",
    port: PORT,
    clients: io.engine.clientsCount,
  });
}

async function handleBroadcast(req: IncomingMessage, res: ServerResponse) {
  // Read body
  let raw = "";
  req.setEncoding("utf8");
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 5 * 1024 * 1024) {
      return respondJson(res, 413, { error: "payload too large" });
    }
  }

  let body: any;
  try {
    body = raw.length === 0 ? {} : JSON.parse(raw);
  } catch {
    return respondJson(res, 400, { error: "invalid json" });
  }

  const { event, payload, token } = body || {};

  if (typeof event !== "string" || event.length === 0) {
    return respondJson(res, 400, { error: "missing or invalid 'event'" });
  }

  // Token check: only enforce if REPLAYAI_BROADCAST_TOKEN is set.
  // In dev (no env var), allow all.
  if (BROADCAST_TOKEN && token !== BROADCAST_TOKEN) {
    return respondJson(res, 401, { error: "unauthorized" });
  }

  io.emit(event, payload);
  const clients = io.engine.clientsCount;
  console.log(`[recording-service] broadcast: ${event} → ${clients} clients`);

  return respondJson(res, 200, { ok: true, clients });
}

function respondJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

// ---------------------------------------------------------------------------
// socket.io connection lifecycle
// ---------------------------------------------------------------------------

io.on("connection", (socket) => {
  console.log(
    `[recording-service] client connected: ${socket.id} total: ${io.engine.clientsCount}`,
  );

  socket.on("disconnect", (reason) => {
    console.log(
      `[recording-service] client disconnected: ${socket.id} (reason: ${reason})`,
    );
  });

  socket.on("error", (err: unknown) => {
    console.error(`[recording-service] socket error (${socket.id}):`, err);
  });
});

// ---------------------------------------------------------------------------
// Startup & graceful shutdown
// ---------------------------------------------------------------------------

httpServer.listen(PORT, HOST, () => {
  console.log(`replayai-recording-service listening on :${PORT}`);
});

function shutdown(signal: string) {
  console.log(`[recording-service] received ${signal}, shutting down...`);
  // io.close() also closes the underlying httpServer it was attached to.
  const forceExit = setTimeout(() => {
    console.error("[recording-service] forcing exit after timeout");
    process.exit(0);
  }, 2000);
  forceExit.unref();

  io.close(() => {
    clearTimeout(forceExit);
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
