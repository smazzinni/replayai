import { AppShell } from "@/components/app-shell";
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-[13px] text-muted-foreground">
          Loading ReplayAI…
        </div>
      }
    >
      <AppShell />
    </Suspense>
  );
}
