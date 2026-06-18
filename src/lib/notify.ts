// Server-only: notify the recording-service (port 3003) to broadcast an event
// to all connected dashboard clients. Fire-and-forget; never throws.

const SERVICE_URL = "http://localhost:3003/broadcast";

export async function broadcast<T = unknown>(
  event: string,
  payload: T,
): Promise<void> {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1500);
    await fetch(SERVICE_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event, payload }),
      signal: controller.signal,
    });
    clearTimeout(t);
  } catch {
    // recording-service may be down; recording still succeeds in the DB.
  }
}
