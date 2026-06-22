# ReplayAI — DVR for AI Agent Workflows

[![GitHub stars](https://img.shields.io/github/stars/smazzinni/replayai?style=social)](https://github.com/smazzinni/replayai)
[![npm version](https://img.shields.io/npm/v/@smazzinni/sdk?color=blue)](https://www.npmjs.com/package/@smazzinni/sdk)
[![PyPI version](https://img.shields.io/pypi/v/replayai-sdk?color=blue)](https://pypi.org/project/replayai-sdk/)
[![License: MIT (SDKs)](https://img.shields.io/badge/SDKs-MIT-green)](./sdks)
[![Website license](https://img.shields.io/badge/website-source--available-orange)](./LICENSE)

Record every AI agent execution as a fully replayable session. Debug
non-deterministic failures in minutes, not hours. Deterministic replay, visual
timelines, diff view, and one-click test export.

> **Live site:** <https://replayai-six.vercel.app/>

---

## SDK Packages (MIT licensed)

The ReplayAI SDKs are the only open-source part of this repository. Instrument
your agents, record sessions, and replay/export them as tests.

| Language    | Install                          | Package                                                                   | Docs                             |
| ----------- | -------------------------------- | ------------------------------------------------------------------------- | -------------------------------- |
| **Python**  | `pip install replayai-sdk`       | [PyPI](https://pypi.org/project/replayai-sdk/)                            | [sdks/python/README.md](./sdks/python/README.md)   |
| **TypeScript** | `npm install @smazzinni/sdk`  | [npm](https://www.npmjs.com/package/@smazzinni/sdk)                       | [sdks/typescript/README.md](./sdks/typescript/README.md) |

Both SDKs are **zero-dependency** (stdlib/Node built-ins only), support
**sync + async**, and ship a **CLI** (`replayai record|test|ui`).

### 30-second usage

```python
from replayai import trace, record_step

@trace("support-agent-v3", project="support-agent", tags=["production"])
def handle_support_ticket(message: str) -> str:
    record_step(
        type="llm_call", name="classify_intent",
        model="gpt-4o-mini", tokens_in=312, tokens_out=24,
        input=f"User: {message}", output="intent: billing_dispute",
        status="success",
    )
    return "Refund issued."
```

```typescript
import { withTrace, recordStep, configure } from "@smazzinni/sdk";

configure({ apiUrl: "http://localhost:3000" });

await withTrace("support-agent-v3", { project: "support-agent" }, async () => {
  await recordStep({ type: "tool_call", name: "issue_refund", status: "success" });
});
```

---

## Run the dashboard locally

The dashboard (this Next.js app) is **source-available** — you can run it
locally for evaluation, but it is not open source (see [License](#license)).

```bash
bun install
echo 'DATABASE_URL=file:/home/z/my-project/db/custom.db' > .env
echo 'REPLAYAI_DEV=1' >> .env
bun run db:push
bun run db:seed
bash scripts/dev.sh
```

Open `http://localhost:3000`.

### Partner program email delivery


When SMTP is not configured (e.g. local dev), submissions are still saved to
the database and visible at `GET /api/waitlist`.

### GitHub stars

The header and CTA display the **live** GitHub star count, fetched from
`GET /api/github` (cached for 5 minutes). Set `GITHUB_TOKEN` in production
to raise the unauthenticated rate limit.

---

## Tech stack

Next.js 16 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · Prisma + SQLite ·
Socket.io · TanStack Query · Framer Motion

---

## Repository

**[github.com/smazzinni/replayai](https://github.com/smazzinni/replayai)**

---

## License

This repository is **dual-licensed**:

- **SDKs (`sdks/python/`, `sdks/typescript/`)** — [MIT License](./sdks/python/LICENSE).
  Use, modify, and distribute freely. See each SDK's `LICENSE` file.
- **Website & dashboard source (everything else — `src/`, `prisma/`,
  `public/`, `mini-services/`, `examples/`, `scripts/`, root config)** —
  **Source-available, proprietary.** All rights reserved by ReplayAI, Inc.
  (Rioforge). You may run it locally for evaluation and contribute back, but
  may not redistribute it or operate a competing product. See
  [LICENSE](./LICENSE) for the full terms.

For licensing or partnership inquiries: **info@rioforge.com**
