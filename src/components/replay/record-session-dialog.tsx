"use client";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useProjects, useCreateSession } from "@/hooks/use-api";
import { toast } from "sonner";
import {
  Circle,
  Loader2,
  Plus,
  Radio,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import type { Project } from "@/lib/replay-data";

interface Scenario {
  id: string;
  label: string;
  description: string;
  outcome: "failed" | "success";
  framework: string;
  build: () => {
    name: string;
    agent: string;
    tags: string[];
    steps: StepInput[];
  };
}

type StepInput = {
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
};

const SCENARIOS: Scenario[] = [
  {
    id: "refund-fail",
    label: "Refund flow — hallucinated approval",
    description:
      "Support agent fabricates a manager-approval token and the refund call fails 3×.",
    outcome: "failed",
    framework: "LangChain",
    build: () => ({
      name: "Customer Support — Refund Query (live sim)",
      agent: "support-agent-v3",
      tags: ["live", "simulated", "refund-flow"],
      steps: [
        {
          type: "llm_call",
          name: "Classify intent",
          t: 0,
          durationMs: 760,
          status: "success",
          model: "gpt-4o-mini",
          tokensIn: 290,
          tokensOut: 22,
          input: "User: 'my card was charged twice, refund me now'",
          output: "intent: billing_dispute · confidence: 0.91",
        },
        {
          type: "tool_call",
          name: "lookup_customer(email)",
          t: 800,
          durationMs: 430,
          status: "success",
          input: "email = ada.l@protonmail.com",
          output: '{ "customer_id": "cus_8821", "plan": "Pro Annual" }',
        },
        {
          type: "tool_call",
          name: "get_charges(customer_id)",
          t: 1270,
          durationMs: 700,
          status: "success",
          input: "customer_id = cus_8821",
          output: '{ "charges": [ch_001, ch_002 (duplicate)] }',
        },
        {
          type: "llm_call",
          name: "Draft response (skips approval)",
          t: 2010,
          durationMs: 1980,
          status: "warning",
          model: "gpt-4o",
          tokensIn: 1620,
          tokensOut: 360,
          input: "System: refund duplicate charges. (policy chunk not retrieved)",
          output: "I'll process a full refund of $24.00 right away.",
        },
        {
          type: "tool_call",
          name: "issue_refund() — missing approval",
          t: 4020,
          durationMs: 980,
          status: "failed",
          input: "charge_id=ch_002, amount=2400",
          output: "ERROR 403: refund_blocked — annual plan requires approval_id.",
        },
        {
          type: "llm_call",
          name: "Retry with hallucinated token",
          t: 5040,
          durationMs: 1450,
          status: "failed",
          model: "gpt-4o",
          tokensIn: 1820,
          tokensOut: 280,
          input: "Tool error: needs approval_id. Retry.",
          output: "approval_id='mgr_auto_2024' (fabricated)",
        },
      ],
    }),
  },
  {
    id: "rag-ok",
    label: "RAG Q&A — policy lookup (success)",
    description: "Docs agent retrieves PTO policy and answers with a citation.",
    outcome: "success",
    framework: "LlamaIndex",
    build: () => ({
      name: "Docs Q&A — PTO carryover (live sim)",
      agent: "docs-qa-agent",
      tags: ["live", "simulated", "rag"],
      steps: [
        {
          type: "retrieval",
          name: "Embed query & search",
          t: 0,
          durationMs: 210,
          status: "success",
          input: "query = 'How many PTO days carry over?'",
          output: "Top-4 chunks (cosine 0.82–0.91) from /hr/handbook",
        },
        {
          type: "llm_call",
          name: "Answer with citations",
          t: 230,
          durationMs: 2840,
          status: "success",
          model: "gpt-4o-mini",
          tokensIn: 1180,
          tokensOut: 210,
          input: "Context: 4 chunks about PTO carryover…",
          output: "Up to 5 days carry over, must be used by March 31 [HR-HBK-§7.3].",
        },
      ],
    }),
  },
  {
    id: "cost-loop",
    label: "Sales agent — retry loop (cost spike)",
    description: "Lead enrichment returns nulls 3× and the agent never breaks.",
    outcome: "failed",
    framework: "Custom",
    build: () => ({
      name: "Sales Outreach — Enrichment loop (live sim)",
      agent: "sales-agent-v1",
      tags: ["live", "simulated", "cost-spike", "loop"],
      steps: [
        {
          type: "llm_call",
          name: "Enrich lead profile",
          t: 0,
          durationMs: 1640,
          status: "success",
          model: "gpt-4o",
          tokensIn: 760,
          tokensOut: 210,
          input: "Lead: Jordan Pike, VP Eng at Northwind",
          output: "Need: size, tech stack, funding",
        },
        {
          type: "tool_call",
          name: "enrich_lead() — primary",
          t: 1680,
          durationMs: 2980,
          status: "warning",
          input: "lead_id = ld_2241",
          output: '{ "size": null, "tech_stack": [], "funding": null }',
        },
        {
          type: "tool_call",
          name: "enrich_lead() — clearbit",
          t: 4700,
          durationMs: 2710,
          status: "warning",
          input: "lead_id = ld_2241, source = clearbit",
          output: '{ "size": null, "tech_stack": [], "funding": null }',
        },
        {
          type: "tool_call",
          name: "enrich_lead() — zoominfo",
          t: 7450,
          durationMs: 2640,
          status: "warning",
          input: "lead_id = ld_2241, source = zoominfo",
          output: '{ "size": null, "tech_stack": [], "funding": null }',
        },
        {
          type: "error",
          name: "Loop guard NOT triggered",
          t: 10120,
          durationMs: 0,
          status: "failed",
          input: "consecutive retries = 3 (cap not configured)",
          output: "No circuit breaker present — agent would keep retrying indefinitely.",
        },
      ],
    }),
  },
];

interface RecordDialogProps {
  onRecorded?: (id: string) => void;
}

export function RecordSessionDialog({ onRecorded }: RecordDialogProps) {
  const [open, setOpen] = useState(false);
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const { data: projects, isLoading: projectsLoading } = useProjects();
  const [projectId, setProjectId] = useState<string>("");
  const create = useCreateSession();

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) ?? SCENARIOS[0];

  const handleRecord = async () => {
    const targetProjectId =
      projectId || projects?.[0]?.id || "";
    if (!targetProjectId) {
      toast.error("No project available to record against.");
      return;
    }
    const built = scenario.build();
    try {
      const session = await create.mutateAsync({
        projectId: targetProjectId,
        name: built.name,
        agent: built.agent,
        framework: scenario.framework,
        tags: built.tags,
        steps: built.steps,
      });
      toast.success("Session recorded", {
        description: `${built.name} · ${built.steps.length} steps`,
      });
      onRecorded?.(session.id);
      setOpen(false);
    } catch (e) {
      toast.error("Failed to record session", {
        description: e instanceof Error ? e.message : "Unknown error",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-[12px] font-semibold text-primary-foreground transition hover:bg-primary/90">
          <Radio className="h-3.5 w-3.5" />
          Record
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <span className="relative flex h-5 w-5 items-center justify-center rounded-md bg-rose-500/15">
              <Circle className="rec-dot h-2.5 w-2.5 fill-rose-500 text-rose-500" />
            </span>
            Record a new session
          </DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Simulates what <code className="rounded bg-muted px-1 font-mono text-[11px]">replayai.trace()</code>{" "}
            captures at the end of an agent run. Pick a scenario and a project —
            the session is ingested via the SDK endpoint and streamed live to
            every open dashboard.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-[12px]">Scenario</Label>
            <Select value={scenarioId} onValueChange={setScenarioId}>
              <SelectTrigger className="h-9 text-[12.5px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCENARIOS.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-[12.5px]">
                    <span className="flex items-center gap-2">
                      {s.outcome === "failed" ? (
                        <TriangleAlert className="h-3 w-3 text-rose-400" />
                      ) : (
                        <Sparkles className="h-3 w-3 text-emerald-400" />
                      )}
                      {s.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11.5px] text-muted-foreground">
              {scenario.description}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[12px]">Project</Label>
            <Select
              value={projectId}
              onValueChange={setProjectId}
              disabled={projectsLoading}
            >
              <SelectTrigger className="h-9 text-[12.5px]">
                <SelectValue
                  placeholder={
                    projectsLoading ? "Loading projects…" : "Select project"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(projects as Project[] | undefined)?.map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-[12.5px]">
                    {p.name} · {p.framework}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Will record</span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-medium",
                  scenario.outcome === "failed"
                    ? "border-rose-500/30 bg-rose-500/10 text-rose-300"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                )}
              >
                {scenario.outcome}
              </span>
            </div>
            <div className="mt-1.5 font-mono text-[11.5px] text-foreground/80">
              {scenario.build().steps.length} steps · {scenario.framework}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="h-8 text-[12.5px]"
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRecord}
            disabled={create.isPending}
            className="h-8 gap-1.5 text-[12.5px]"
          >
            {create.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {create.isPending ? "Recording…" : "Record session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
