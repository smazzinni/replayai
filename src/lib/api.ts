// Client-side typed API helpers for ReplayAI.
// All requests use relative paths (the Next.js API on port 3000).

import type { AgentSession, Project } from "@/lib/replay-data";

export interface SessionListParams {
  projectId?: string;
  status?: "all" | "success" | "failed" | "running";
  q?: string;
  limit?: number;
  orderBy?: "startedAt" | "durationMs" | "costUsd" | "tokenTotal";
}

export interface Stats {
  totalSessions: number;
  failedSessions: number;
  successSessions: number;
  runningSessions: number;
  totalSteps: number;
  totalTokens: number;
  totalCost: number;
  projects: number;
  failRate: number;
  avgDurationMs: number;
  avgSteps: number;
  dailyTrend: { date: string; total: number; failed: number }[];
  costByModel: { model: string; cost: number; tokens: number; steps: number }[];
  recentIds: string[];
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body.error ?? msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async listProjects(): Promise<Project[]> {
    const r = await fetch("/api/projects", { cache: "no-store" });
    const data = await jsonOrThrow<{ projects: Project[] }>(r);
    return data.projects;
  },

  async createProject(input: {
    name: string;
    framework?: string;
    description?: string;
  }): Promise<Project> {
    const r = await fetch("/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await jsonOrThrow<{ project: Project }>(r);
    return data.project;
  },

  async listSessions(
    params: SessionListParams = {},
  ): Promise<{ sessions: AgentSession[]; total: number; hasMore: boolean }> {
    const sp = new URLSearchParams();
    if (params.projectId) sp.set("projectId", params.projectId);
    if (params.status && params.status !== "all")
      sp.set("status", params.status);
    if (params.q) sp.set("q", params.q);
    if (params.limit) sp.set("limit", String(params.limit));
    if (params.orderBy) sp.set("orderBy", params.orderBy);
    const r = await fetch(`/api/sessions?${sp}`, { cache: "no-store" });
    return jsonOrThrow(r);
  },

  async getSession(id: string): Promise<AgentSession> {
    const r = await fetch(`/api/sessions/${id}`, { cache: "no-store" });
    const data = await jsonOrThrow<{ session: AgentSession }>(r);
    return data.session;
  },

  async createSession(input: {
    projectId?: string;
    projectSlug?: string;
    name: string;
    agent: string;
    framework: string;
    status?: string;
    startedAt?: string;
    durationMs?: number;
    tokenTotal?: number;
    costUsd?: number;
    tags?: string[];
    steps: Array<{
      type: string;
      name: string;
      t: number;
      durationMs: number;
      status: string;
      model?: string;
      tokensIn?: number;
      tokensOut?: number;
      input: string;
      output: string;
    }>;
  }): Promise<AgentSession> {
    const r = await fetch("/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await jsonOrThrow<{ session: AgentSession }>(r);
    return data.session;
  },

  async updateSession(
    id: string,
    patch: { name?: string; status?: string; tags?: string[] },
  ): Promise<AgentSession> {
    const r = await fetch(`/api/sessions/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    const data = await jsonOrThrow<{ session: AgentSession }>(r);
    return data.session;
  },

  async deleteSession(id: string): Promise<void> {
    const r = await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    await jsonOrThrow<{ ok: boolean }>(r);
  },

  async getStats(): Promise<Stats> {
    const r = await fetch("/api/stats", { cache: "no-store" });
    return jsonOrThrow<Stats>(r);
  },

  exportUrl(id: string, lang: "pytest" | "jest", download = false): string {
    const sp = new URLSearchParams({ lang });
    if (download) sp.set("download", "1");
    return `/api/sessions/${id}/export?${sp}`;
  },
};
