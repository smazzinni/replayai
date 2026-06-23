#!/usr/bin/env node
// ReplayAI TypeScript SDK CLI — `replayai ui`, `replayai version`.
//
// Usage:
//   replayai ui [--port 7373] [--storage-path ./ReplayAI] [--no-browser]
//   replayai version
//
// The `ui` command launches the bundled self-contained dashboard server that
// reads locally-stored sessions and serves a complete UI at the given port.
import { startServer } from "./dashboard-server.js";
function printHelp() {
    console.log(`
ReplayAI CLI — record, replay, and view AI agent sessions.

Usage:
  replayai ui [--port 7373] [--storage-path ./ReplayAI] [--no-browser]
  replayai version
  replayai help

Commands:
  ui       Start the dashboard server (self-contained, reads local sessions).
  version  Print the SDK version.
  help     Show this help message.

Options for 'ui':
  --port <n>              Port to listen on (default: 7373).
  --storage-path <path>   Local storage path (default: ./ReplayAI).
  --no-browser            Don't auto-open the browser.

Environment variables:
  REPLAYAI_STORAGE         local | cloud | both (default: local)
  REPLAYAI_STORAGE_PATH    Local storage directory (default: ./ReplayAI)
  REPLAYAI_API_URL         Cloud API base URL
  REPLAYAI_DASHBOARD_URL   Dashboard base URL for session links
  REPLAYAI_TOKEN           Cloud API token
  REPLAYAI_STRICT          Raise on errors instead of warning

Examples:
  replayai ui                                    # Start dashboard on :7373
  replayai ui --port 8080 --storage-path ./logs  # Custom port + storage
  replayai version                               # Print version
`);
}
function main() {
    const args = process.argv.slice(2);
    const cmd = args[0];
    if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
        printHelp();
        process.exit(0);
    }
    if (cmd === "version" || cmd === "--version" || cmd === "-v") {
        console.log("replayai-sdk/0.7.3");
        process.exit(0);
    }
    if (cmd === "ui") {
        let port = 7373;
        let storagePath = process.env.REPLAYAI_STORAGE_PATH || "./ReplayAI";
        let storagePathExplicit = false;
        let openBrowser = true;
        for (let i = 1; i < args.length; i++) {
            const a = args[i];
            if (a === "--port" || a === "-p") {
                port = parseInt(args[++i] || "", 10) || port;
            }
            else if (a === "--storage-path" || a === "-s") {
                storagePath = args[++i] || storagePath;
                storagePathExplicit = true;
            }
            else if (a === "--storage") {
                // Backward compat: --storage was the old name for --storage-path.
                storagePath = args[++i] || storagePath;
                storagePathExplicit = true;
            }
            else if (a === "--no-browser") {
                openBrowser = false;
            }
            else if (a === "--help" || a === "-h") {
                console.log("Usage: replayai ui [--port 7373] [--storage-path ./ReplayAI] [--no-browser]");
                process.exit(0);
            }
            else {
                console.error(`Unknown option: ${a}`);
                console.error("Run \`replayai help\` for usage.");
                process.exit(1);
            }
        }
        // Set env vars so the config resolves correctly.
        // Only overwrite REPLAYAI_STORAGE_PATH if the user explicitly passed --storage-path.
        process.env.REPLAYAI_STORAGE = process.env.REPLAYAI_STORAGE || "local";
        if (storagePathExplicit) {
            process.env.REPLAYAI_STORAGE_PATH = storagePath;
        }
        console.log(`[replayai] starting dashboard in local mode on port ${port}`);
        console.log(`  storage: ${storagePath}`);
        startServer({ port, storagePath, openBrowser });
        return;
    }
    console.error(`Unknown command: ${cmd}`);
    console.error("Run `replayai help` for usage.");
    process.exit(1);
}
main();
//# sourceMappingURL=cli.js.map