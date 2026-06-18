"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Check, Sparkles } from "lucide-react";
import { SectionHeading } from "./problem";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    cadence: "/user/mo",
    tagline: "For individual devs getting hooked",
    cta: "Start free",
    highlight: false,
    features: [
      "100 sessions / month",
      "Local-only storage",
      "Full replay & timeline",
      "Diff view",
      "Community support",
    ],
  },
  {
    name: "Pro",
    price: "$49",
    cadence: "/user/mo",
    tagline: "For teams shipping agents to prod",
    cta: "Start 14-day trial",
    highlight: true,
    features: [
      "Unlimited sessions",
      "Cloud storage + sharing",
      "Test export (pytest & jest)",
      "GitHub Actions integration",
      "Team comments & mentions",
      "30-day session retention",
    ],
  },
  {
    name: "Enterprise",
    price: "$299",
    cadence: "/user/mo",
    tagline: "For compliance & scale",
    cta: "Talk to sales",
    highlight: false,
    features: [
      "Everything in Pro",
      "SSO / SAML",
      "Immutable audit logs",
      "On-prem deployment",
      "Priority support + SLA",
      "Custom retention & DPA",
    ],
  },
];

export function Pricing() {
  return (
    <section
      id="pricing"
      className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6"
    >
      <SectionHeading
        center
        eyebrow="Pricing"
        title="Land free. Expand to the team."
        sub="Free tier gets individual devs hooked on replay-driven debugging. The enterprise tier sells to their manager the moment they need compliance, sharing, or on-prem."
      />

      <div className="mt-12 grid items-stretch gap-5 lg:grid-cols-3">
        {TIERS.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className={cn(
              "relative flex flex-col rounded-2xl border p-6",
              t.highlight
                ? "border-primary/50 bg-card/70 glow-primary"
                : "border-border/60 bg-card/40",
            )}
          >
            {t.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[10.5px] font-semibold text-primary-foreground shadow-lg shadow-primary/30">
                  <Sparkles className="h-3 w-3" /> Most popular
                </span>
              </div>
            )}
            <div>
              <h3 className="text-[16px] font-semibold tracking-tight">
                {t.name}
              </h3>
              <p className="mt-1 text-[12px] text-muted-foreground">
                {t.tagline}
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">
                  {t.price}
                </span>
                <span className="text-[12.5px] text-muted-foreground">
                  {t.cadence}
                </span>
              </div>
            </div>

            <ul className="mt-6 flex-1 space-y-2.5">
              {t.features.map((f) => (
                <li
                  key={f}
                  className="flex items-start gap-2 text-[13px] text-foreground/85"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full",
                      t.highlight
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Check className="h-2.5 w-2.5" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="#cta"
              className={cn(
                "mt-6 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[13.5px] font-semibold transition",
                t.highlight
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "border border-border/60 bg-background/40 text-foreground hover:bg-muted/40",
              )}
            >
              {t.cta}
            </a>
          </motion.div>
        ))}
      </div>

      <p className="mt-6 text-center text-[12px] text-muted-foreground">
        No credit card required for Free. Pro trial includes unlimited sessions
        for 14 days.
      </p>
    </section>
  );
}
