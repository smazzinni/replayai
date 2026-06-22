"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { io } from "socket.io-client";
import { useEffect, useState } from "react";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

/** Connects to the recording-service (port 3003) and invalidates React Query caches on live events. */
function RealtimeListener() {
  const qc = useQueryClient();
  useEffect(() => {
    const socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 2000,
      timeout: 8000,
    });

    const bumpSessions = () => {
      qc.invalidateQueries({ queryKey: ["sessions"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    };

    socket.on("session:created", () => bumpSessions());
    socket.on("session:updated", (p: { session?: { id?: string } }) => {
      bumpSessions();
      if (p?.session?.id) {
        qc.invalidateQueries({ queryKey: ["session", p.session.id] });
      }
    });
    socket.on("session:deleted", (p: { id?: string }) => {
      bumpSessions();
      if (p?.id) qc.removeQueries({ queryKey: ["session", p.id] });
    });

    return () => {
      socket.disconnect();
    };
  }, [qc]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => makeQueryClient());
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        disableTransitionOnChange
      >
        <RealtimeListener />
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
