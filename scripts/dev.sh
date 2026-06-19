#!/bin/bash
# dev.sh — starts `next dev` as a detached daemon with auto-restart.
# Uses setsid to survive shell exits between tool calls.
# Pre-warms routes sequentially to avoid parallel-compilation memory spikes.

cd "$(dirname "$0")/.."

lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
pkill -9 -f "next dev" 2>/dev/null
pkill -9 -f "next-server" 2>/dev/null
pkill -9 -f "dev-supervisor" 2>/dev/null
sleep 1

> dev.log

cat > /tmp/dev-supervisor.sh << 'SUPERVISOR'
cd /home/z/my-project
> dev.log

RESTART=0
while true; do
  RESTART=$((RESTART + 1))
  echo "[supervisor] attempt $RESTART at $(date -Iseconds)" >> dev.log

  NODE_OPTIONS="--max-old-space-size=2048" \
  /home/z/my-project/node_modules/.bin/next dev -p 3000 >> dev.log 2>&1 &
  SERVER_PID=$!

  for i in $(seq 1 60); do
    grep -q "Ready" dev.log 2>/dev/null && break
    sleep 0.5
  done

  ROUTES=(
    "/"
    "/api/stats"
    "/api/projects"
    "/api/sessions?limit=200"
    "/api/onboarding"
    "/api/tokens"
    "/api/waitlist"
    "/?view=developers&doc=introduction"
    "/?view=setup"
  )
  for r in "${ROUTES[@]}"; do
    curl -s -o /dev/null "http://localhost:3000${r}" 2>/dev/null
    sleep 1
  done
  echo "[supervisor] pre-warm done" >> dev.log

  wait $SERVER_PID 2>/dev/null
  EXIT=$?
  echo "[supervisor] server exited (code $EXIT) at $(date -Iseconds)" >> dev.log

  lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null
  pkill -9 -f "next-server" 2>/dev/null
  sleep 2
done
SUPERVISOR

chmod +x /tmp/dev-supervisor.sh
setsid bash /tmp/dev-supervisor.sh < /dev/null > /dev/null 2>&1 &
echo "[dev.sh] supervisor started in background"
