"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "replayai:starred-sessions";

/** Client-side starred-session bookmarks (persisted to localStorage). */
export function useStarredSessions() {
  const [starred, setStarred] = useState<Set<string>>(new Set());

  // Load from localStorage on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStarred(new Set(arr));
      }
    } catch {
      /* ignore parse errors */
    }
  }, []);

  const persist = useCallback((next: Set<string>) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
    } catch {
      /* storage might be full or disabled */
    }
  }, []);

  const toggleStar = useCallback(
    (id: string) => {
      setStarred((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const isStarred = useCallback((id: string) => starred.has(id), [starred]);

  return { starred, isStarred, toggleStar };
}
