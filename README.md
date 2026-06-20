# ReplayAI — DVR for AI Agent Workflows

Record every AI agent execution as a fully replayable session. Debug non-deterministic failures in minutes, not hours.

## SDK Packages

- **Python**: `pip install replayai-sdk` (imports as `replayai`) — [PyPI](https://pypi.org/project/replayai-sdk/)
- **TypeScript**: `npm install @smazzinni/sdk` — [npm](https://www.npmjs.com/package/@smazzinni/sdk)

## Quick Start

```bash
bun install
echo 'DATABASE_URL=file:./db/custom.db' > .env
echo 'REPLAYAI_DEV=1' >> .env
bun run db:push
bun run db:seed
bash scripts/dev.sh
```

Open `http://localhost:3000`.

## Tech Stack

Next.js 16 · TypeScript 5 · Tailwind CSS 4 · shadcn/ui · Prisma + SQLite · Socket.io · TanStack Query

## Repository

[github.com/smazzinni/replayai](https://github.com/smazzinni/replayai)

## License

MIT
