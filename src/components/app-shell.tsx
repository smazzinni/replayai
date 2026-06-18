"use client";

import { useSearchParams } from "next/navigation";
import { DOCS } from "@/lib/docs-content";
import { DocsApp } from "@/components/docs/docs-app";
import { OnboardingApp } from "@/components/onboarding/onboarding-app";
import { Dashboard } from "@/components/replay/dashboard";
import { CTA } from "@/components/landing/cta";
import { Features } from "@/components/landing/features";
import { Footer } from "@/components/landing/footer";
import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { Pricing } from "@/components/landing/pricing";
import { Problem } from "@/components/landing/problem";
import { Roadmap } from "@/components/landing/roadmap";
import { SectionHeading } from "@/components/landing/problem";
import { WaitlistForm } from "@/components/landing/waitlist-form";
import { MousePointerClick } from "lucide-react";
import { Suspense } from "react";

function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Problem />

        <section
          id="demo"
          className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6"
        >
          <SectionHeading
            eyebrow="Live demo"
            title="This is the actual product, not a screenshot"
            sub="Pick a failed session, hit Play, and scrub through every step the agent took. Then diff it against the fixed run and export it as a test. Everything below is fully interactive — data is live from the API."
          />
          <div className="mt-6 flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5 text-primary" />
            Try it — record a session, hit Play, diff two runs, export a test
          </div>
          <div className="mt-8">
            <Suspense
              fallback={
                <div className="flex h-[660px] items-center justify-center rounded-2xl border border-border/60 bg-card/40 text-[12.5px] text-muted-foreground">
                  Loading dashboard…
                </div>
              }
            >
              <Dashboard />
            </Suspense>
          </div>
        </section>

        <Features />
        <Pricing />
        <Roadmap />

        {/* Design partner program */}
        <section
          id="design-partners"
          className="relative mx-auto max-w-4xl px-4 py-20 sm:px-6"
        >
          <SectionHeading
            center
            eyebrow="Design partners"
            title="Ship with us. Get free Pro for a year."
            sub="We're onboarding 25 teams building production AI agents. Get white-glove setup, direct access to the founders, priority features, and 12 months of Pro — free."
          />
          <div className="mt-10">
            <WaitlistForm />
          </div>
        </section>

        <CTA />
      </main>
      <Footer />
    </div>
  );
}

export function AppShell() {
  const params = useSearchParams();
  const view = params.get("view");

  if (view === "developers") {
    const docSlug = params.get("doc") ?? "introduction";
    const validSlug = DOCS[docSlug] ? docSlug : "introduction";
    return <DocsApp initialDoc={validSlug} />;
  }

  if (view === "setup") {
    return <OnboardingApp />;
  }

  return <Landing />;
}
