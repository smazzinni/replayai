"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api, type SessionListParams, type Stats } from "@/lib/api";
import type { AgentSession, Project } from "@/lib/replay-data";

export const queryKeys = {
  projects: ["projects"] as const,
  sessions: (params: SessionListParams) => ["sessions", params] as const,
  session: (id: string | null) => ["session", id] as const,
  stats: ["stats"] as const,
};

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: api.listProjects,
  });
}

export function useSessions(params: SessionListParams) {
  return useQuery({
    queryKey: queryKeys.sessions(params),
    queryFn: () => api.listSessions(params),
    placeholderData: (prev) => prev,
  });
}

export function useSession(id: string | null) {
  return useQuery({
    queryKey: queryKeys.session(id),
    queryFn: () => api.getSession(id as string),
    enabled: !!id,
  });
}

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: api.getStats,
    refetchInterval: 15000,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createSession,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.deleteSession,
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: queryKeys.stats });
      qc.removeQueries({ queryKey: queryKeys.session(id) });
    },
  });
}

export function useUpdateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string;
      patch: { name?: string; status?: string; tags?: string[] };
    }) => api.updateSession(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["session"] });
      qc.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createProject,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.projects });
    },
  });
}

export type { AgentSession, Project, Stats };
