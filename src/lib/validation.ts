// Server-only validation schemas and helpers for API routes.
import { z } from "zod";

export const MAX_BODY_SIZE = 1024 * 1024;

export async function readBody(req: Request): Promise<string> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    throw new HttpError(413, "Request body too large (max 1 MB)");
  }
  const text = await req.text();
  if (text.length > MAX_BODY_SIZE) {
    throw new HttpError(413, "Request body too large (max 1 MB)");
  }
  return text;
}

export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T } | { error: string; status: number }> {
  let raw: string;
  try {
    raw = await readBody(req);
  } catch (e) {
    if (e instanceof HttpError) return { error: e.message, status: e.status };
    return { error: "Failed to read body", status: 400 };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "Invalid JSON", status: 400 };
  }
  const result = schema.safeParse(json);
  if (!result.success) {
    const first = result.error.issues[0];
    return { error: first ? `${first.path.join(".")}: ${first.message}` : "Validation failed", status: 400 };
  }
  return { data: result.data };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const STEP_TYPES = ["llm_call", "tool_call", "retrieval", "decision", "error"] as const;
const STEP_STATUSES = ["success", "failed", "running", "warning"] as const;

export const stepSchema = z.object({
  type: z.enum(STEP_TYPES).default("llm_call"),
  name: z.string().max(200).default("step"),
  t: z.number().int().min(0).optional(),
  offsetMs: z.number().int().min(0).optional(),
  durationMs: z.number().int().min(0).optional(),
  status: z.enum(STEP_STATUSES).default("success"),
  model: z.string().max(100).optional(),
  tokensIn: z.number().int().min(0).optional(),
  tokensOut: z.number().int().min(0).optional(),
  input: z.string().max(50000).default(""),
  output: z.string().max(50000).default(""),
});

export const sessionIngestSchema = z.object({
  projectId: z.string().max(100).optional(),
  projectSlug: z.string().max(100).optional(),
  name: z.string().max(300).optional(),
  agent: z.string().max(200).optional(),
  framework: z.string().max(50).optional(),
  status: z.enum(["success", "failed", "running"]).optional(),
  startedAt: z.string().datetime().optional(),
  durationMs: z.number().int().min(0).optional(),
  tokenTotal: z.number().int().min(0).optional(),
  costUsd: z.number().min(0).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  steps: z.array(stepSchema).max(500).default([]),
});

export const sessionPatchSchema = z.object({
  name: z.string().max(300).optional(),
  status: z.enum(["success", "failed", "running"]).optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
});

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(100),
  framework: z.string().max(50).optional(),
  description: z.string().max(1000).optional(),
});

export const waitlistSchema = z.object({
  email: z.string().email().max(200),
  name: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  role: z.string().max(200).optional(),
  teamSize: z.string().max(20).optional(),
  useCase: z.string().max(2000).optional(),
});

export const tokenCreateSchema = z.object({
  name: z.string().max(100).optional(),
  scope: z.enum(["live", "readonly", "test"]).optional(),
});
