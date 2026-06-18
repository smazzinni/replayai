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
import { MousePointerClick } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Hero />
        <Problem />

        {/* Live demo */}
        <section id="demo" className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionHeading
            eyebrow="Live demo"
            title="This is the actual product, not a screenshot"
            sub="Pick a failed session, hit Play, and scrub through every step the agent took. Then diff it against the fixed run and export it as a test. Everything below is fully interactive."
          />
          <div className="mt-6 flex items-center justify-center gap-2 text-[12px] text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5 text-primary" />
            Try it — switch tabs, hit Play, pick different sessions
          </div>
          <div className="mt-8">
            <Dashboard />
          </div>
        </section>

        <Features />
        <Pricing />
        <Roadmap />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
