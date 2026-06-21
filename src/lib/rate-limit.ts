// Simple in-memory rate limiter (per-IP, sliding window).
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

interface Entry { count: number; resetAt: number; }
const store = new Map<string, Entry>();

let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

export function rateLimit(ip: string): { ok: boolean; remaining: number } {
  cleanup();
  const now = Date.now();
  const entry = store.get(ip);
  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { ok: true, remaining: MAX_REQUESTS - 1 };
  }
  entry.count++;
  if (entry.count > MAX_REQUESTS) return { ok: false, remaining: 0 };
  return { ok: true, remaining: MAX_REQUESTS - entry.count };
}

export function getClientIP(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export function tooManyRequests() {
  return Response.json(
    { error: "Too many requests. Please slow down." },
    { status: 429, headers: { "Retry-After": "60" } },
  );
}
