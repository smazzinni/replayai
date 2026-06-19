# ReplayAI — DVR for AI Agent Workflows

Record every AI agent execution as a fully replayable session. Debug non-deterministic failures in minutes, not hours. Deterministic replay, visual timelines, diff view, and one-click test export.

![ReplayAI Dashboard](https://img.shields.io/badge/ReplayAI-v0.4.1-emerald)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Prisma](https://img.shields.io/badge/Prisma-6-indigo)
![License](https://img.shields.io/badge/License-MIT-green)

## The Problem

When an AI agent fails, engineers waste hours trying to reproduce the exact sequence of prompts, tool calls, and context that led to the failure. Existing logging gives you text dumps, but you can't *re-run* the exact conditions to debug.

## The Solution

ReplayAI records every agent execution — every LLM call, tool call, retrieval, and decision — as a fully replayable session you can scrub, diff, and export as a deterministic regression test.

### Features

- **Session Recording** — A single decorator (`@trace()`) wraps your agent and captures inputs, outputs, timing, tokens, and costs.
- **Deterministic Replay** — Re-run any recorded session with tool & RAG responses mocked from the recording. Free and 100% reproducible.
- **Visual Timeline** — Scrub through every step like a video. See call ordering, durations, and failures at a glance.
- **Diff View** — Compare two sessions side-by-side to find exactly where behavior diverged.
- **Export to Test** — One click turns a failing session into a pytest or jest regression test with mocks auto-extracted.
- **Realtime Updates** — WebSocket-powered live dashboard; new recordings appear instantly across all connected clients.
- **SDK Packages** — Real Python (`replayai`) and TypeScript (`@replayai/sdk`) packages that record and POST to the API.

## Quick Start

### 1. Install dependencies

```bash
bun install
```

### 2. Set up the database

```bash
# .env
DATABASE_URL=file:./db/custom.db
REPLAYAI_DEV=1

# Push schema + seed demo data
bun run db:push
bun run db:seed
```

### 3. Start the dev server

```bash
bun run dev
```

The app runs on `http://localhost:3000`. A supervisor script (`scripts/dev.sh`) auto-restarts the server if it crashes and pre-warms routes to avoid compilation memory spikes.

### 4. Start the recording service (WebSocket relay)

```bash
cd mini-services/recording-service
bun install
bun run dev  # runs on port 3003
```

### 5. Use the SDKs

```bash
# Python
cd sdks/python
pip install -e .
python examples/quickstart.py

# TypeScript
cd sdks/typescript
bun install
bun examples/quickstart.ts
```

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | Prisma ORM + SQLite |
| State | TanStack Query (server), Zustand (client) |
| Realtime | Socket.io (mini-service on port 3003) |
| SDKs | Python (stdlib-only), TypeScript (zero deps) |
| Auth | Bearer tokens (SHA-256 hashed), dev bypass |
| Validation | Zod schemas on all mutation endpoints |
| Rate Limiting | In-memory sliding window (120 req/min/IP) |

## Project Structure

```
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # REST API (12 routes)
│   │   ├── page.tsx            # Single-route app (landing + dashboard + docs + setup)
│   │   ├── error.tsx           # Error boundary
│   │   └── not-found.tsx       # 404 page
│   ├── components/
│   │   ├── landing/            # Marketing page sections
│   │   ├── replay/             # Dashboard (timeline, diff, export, sessions list)
│   │   ├── docs/               # 18-page developer documentation site
│   │   └── onboarding/         # 1-click install / token generation wizard
│   ├── lib/                    # Shared logic (auth, db, validation, mappers, etc.)
│   └── hooks/                  # React hooks (use-api, use-mounted)
├── prisma/
│   ├── schema.prisma           # Project, Session, Step, ApiToken, WaitlistEntry
│   └── seed.ts                 # Seeds 4 projects + 5 demo sessions
├── sdks/
│   ├── python/                 # `replayai` Python SDK (stdlib-only)
│   └── typescript/             # `@replayai/sdk` TypeScript SDK (zero deps)
├── mini-services/
│   └── recording-service/      # Socket.io broadcast relay (port 3003)
├── scripts/
│   └── dev.sh                  # Auto-restart supervisor with route pre-warming
└── next.config.ts              # Security headers, package import optimization
```

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api` | Health check |
| GET | `/api/stats` | Workspace aggregate statistics |
| GET/POST | `/api/projects` | List / create projects |
| GET | `/api/projects/[slug]` | Get a project by slug |
| GET/POST | `/api/sessions` | List (filter/search/paginate) / ingest sessions |
| GET/PATCH/DELETE | `/api/sessions/[id]` | Get / update / delete a session |
| GET | `/api/sessions/[id]/export` | Generate pytest/jest test (with download) |
| GET/POST | `/api/tokens` | List / create API tokens |
| DELETE | `/api/tokens/[id]` | Revoke a token |
| GET/POST | `/api/onboarding` | Setup status / test connection |
| GET/POST | `/api/waitlist` | List / join design-partner waitlist |

Full API docs: [`/?view=developers&doc=api-overview`](/?view=developers&doc=api-overview)

## SDK Usage

### Python

```python
from replayai import trace, record_step

@trace("my-agent", project="my-project", tags=["prod"])
def run(message: str) -> str:
    intent = classify(message)      # LLM call — recorded
    result = tool(intent)           # tool call — recorded
    return draft(result)            # LLM call — recorded
```

### TypeScript

```typescript
import { withTrace, recordStep } from "@replayai/sdk";

await withTrace("my-agent", { project: "my-project", tags: ["prod"] }, async () => {
  const intent = await classify(message);
  const result = await tool(intent);
  return draft(result);
});
```

## Configuration

| Env Var | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | SQLite database path |
| `REPLAYAI_DEV` | — | Set to `1` to bypass auth in development |
| `REPLAYAI_API_URL` | `http://localhost:3000` | API base URL (used by SDKs) |
| `REPLAYAI_TOKEN` | — | API token for cloud mode |
| `REPLAYAI_SAMPLE_RATE` | `1.0` | Fraction of sessions to record |

## Security

- API tokens are SHA-256 hashed at rest (raw value shown once at creation)
- Secrets in prompts are auto-redacted before recording (`sk-...`, `Bearer ...`, custom patterns)
- Security headers: X-Content-Type-Options, X-Frame-Options (DENY), HSTS, Referrer-Policy, Permissions-Policy
- Rate limiting on all API routes (120 req/min/IP)
- Request body size limit (1MB)
- Zod input validation on all mutation endpoints

## Production Deployment

```bash
# Build
bun run build

# Run the production server
bun run start

# Set REPLAYAI_DEV=0 (or unset) to enforce auth
# Create an API token via the onboarding wizard (?view=setup)
```

## License

MIT
