"use client";

import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  History,
  KeyRound,
  Loader2,
  Plug,
  Plus,
  Rocket,
  ShieldCheck,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { CodeBlock } from "@/components/replay/code-block";

interface Token {
  id: string;
  prefix: string;
  name: string;
  scope: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface OnboardingStatus {
  hasToken: boolean;
  hasProject: boolean;
  hasSession: boolean;
  tokenCount: number;
  projectCount: number;
  sessionCount: number;
  devMode: boolean;
  install: { python: string; typescript: string; cli: string };
}

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const r = await fetch(url, opts);
  if (!r.ok) {
    const b = await r.json().catch(() => ({}));
    throw new Error(b.error ?? `Request failed (${r.status})`);
  }
  return r.json() as Promise<T>;
}

export function OnboardingApp() {
  const router = useRouter();
  const qc = useQueryClient();
  const [rawToken, setRawToken] = useState<string | null>(null);

  const statusQ = useQuery<OnboardingStatus>({
    queryKey: ["onboarding"],
    queryFn: () => api("/api/onboarding"),
  });
  const tokensQ = useQuery<{ tokens: Token[] }>({
    queryKey: ["tokens"],
    queryFn: () => api("/api/tokens"),
  });

  const createToken = useMutation({
    mutationFn: () =>
      api<{ token: Token; rawToken: string }>("/api/tokens", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Development", scope: "live" }),
      }),
    onSuccess: (data) => {
      setRawToken(data.rawToken);
      qc.invalidateQueries({ queryKey: ["tokens"] });
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      toast.success("Token created", {
        description: "Copy it now — it won't be shown again.",
      });
    },
    onError: (e) =>
      toast.error("Failed to create token", {
        description: e instanceof Error ? e.message : "Unknown error",
      }),
  });

  const revokeToken = useMutation({
    mutationFn: (id: string) =>
      api(`/api/tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tokens"] });
      qc.invalidateQueries({ queryKey: ["onboarding"] });
      toast.success("Token revoked");
    },
  });

  const testConnection = useMutation({
    mutationFn: () =>
      api<{ connected: boolean; devBypass: boolean; message: string }>(
        "/api/onboarding",
        { method: "POST" },
      ),
    onSuccess: (data) =>
      toast.success(data.message, {
        description: data.devBypass
          ? "Auth is bypassed in dev mode."
          : "Your token is valid.",
      }),
    onError: (e) =>
      toast.error("Connection failed", {
        description: e instanceof Error ? e.message : "Unknown error",
      }),
  });

  const s = statusQ.data;
  const tokens = tokensQ.data?.tokens ?? [];

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* top bar */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-3 px-4 sm:px-6">
          <a href="/" onClick={(e) => { e.preventDefault(); router.push("/"); }} className="flex items-center gap-2">
            <span className="relative flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 ring-1 ring-primary/30">
              <History className="h-4 w-4 text-primary" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              Replay<span className="text-primary">AI</span>
            </span>
            <span className="ml-1 hidden rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground sm:inline">
              Setup
            </span>
          </a>
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); router.push("/"); }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12.5px] text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to app
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        {/* hero */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
            <Rocket className="h-3 w-3 text-primary" /> Get set up in 60 seconds
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            Install ReplayAI &amp; record your first session
          </h1>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
            Three steps: install the SDK, generate an API token, verify the
            connection. Then wrap any agent in{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px] text-primary">
              trace()
            </code>{" "}
            and every run becomes a replayable session.
          </p>
        </div>

        {/* progress strip */}
        {s && (
          <div className="mb-8 grid grid-cols-3 gap-3">
            <ProgressStep done={true} label="Install SDK" n={1} />
            <ProgressStep done={s.hasToken} label="Generate token" n={2} />
            <ProgressStep done={s.hasSession} label="Record a session" n={3} />
          </div>
        )}

        {/* step 1: install */}
        <section className="mb-8 rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6">
          <StepHeader n={1} title="Install the SDK" icon={TerminalSquare} />
          <p className="mt-2 text-[13px] text-muted-foreground">
            Pick the runtime your agent runs in. Both SDKs are dependency-free
            and work the same way.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {s && (
              <InstallCard
                label="Python"
                cmd={s.install.python}
                onCopy={() => copy(s.install.python, "Python install")}
              />
            )}
            {s && (
              <InstallCard
                label="TypeScript / Node"
                cmd={s.install.typescript}
                onCopy={() => copy(s.install.typescript, "TS install")}
              />
            )}
            {s && (
              <InstallCard
                label="CLI (dashboard)"
                cmd={s.install.cli}
                onCopy={() => copy(s.install.cli, "CLI install")}
              />
            )}
          </div>

          <div className="mt-5">
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Then wrap your agent
            </div>
            <CodeBlock
              language="python"
              code={`from replayai import trace

@trace("my-agent", project="my-project", tags=["prod"])
def run(message: str) -> str:
    intent = classify(message)      # LLM call — recorded
    result = tool(intent)           # tool call — recorded
    return draft(result)            # LLM call — recorded`}
              maxHeight="max-h-64"
            />
          </div>
        </section>

        {/* step 2: token */}
        <section className="mb-8 rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6">
          <StepHeader n={2} title="Generate an API token" icon={KeyRound} />
          <p className="mt-2 text-[13px] text-muted-foreground">
            The SDK uses this token to authenticate session ingestion.{" "}
            {s?.devMode ? (
              <span className="text-amber-300">
                Dev mode is on — auth is bypassed, so a token is optional right
                now, but you&apos;ll need one for production.
              </span>
            ) : (
              <span>Required for all SDK requests.</span>
            )}
          </p>

          <button
            onClick={() => createToken.mutate()}
            disabled={createToken.isPending}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
          >
            {createToken.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            {createToken.isPending ? "Generating…" : "Generate token"}
          </button>

          {/* newly created token — shown once */}
          {rawToken && (
            <div className="mt-4 overflow-hidden rounded-lg border border-emerald-500/40 bg-emerald-500/[0.07]">
              <div className="flex items-center gap-2 border-b border-emerald-500/20 px-3 py-2 text-[11px] font-medium text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Copy your token now — it won&apos;t be shown again
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <code className="flex-1 truncate font-mono text-[12.5px] text-foreground">
                  {rawToken}
                </code>
                <button
                  onClick={() => copy(rawToken, "Token")}
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-2 py-1 text-[11px] font-medium text-foreground transition hover:bg-muted"
                >
                  <Copy className="h-3 w-3" /> Copy
                </button>
              </div>
            </div>
          )}

          {/* existing tokens */}
          {tokens.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Active tokens ({tokens.length})
              </div>
              <div className="space-y-2">
                {tokens.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
                  >
                    <KeyRound className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12.5px] text-foreground">
                          {t.prefix}
                        </span>
                        <span className="rounded bg-muted px-1.5 py-px text-[9.5px] uppercase tracking-wide text-muted-foreground">
                          {t.scope}
                        </span>
                      </div>
                      <div className="mt-0.5 text-[10.5px] text-muted-foreground">
                        {t.name} · created{" "}
                        {new Date(t.createdAt).toLocaleDateString()}
                        {t.lastUsedAt &&
                          ` · last used ${new Date(t.lastUsedAt).toLocaleDateString()}`}
                      </div>
                    </div>
                    <button
                      onClick={() => revokeToken.mutate(t.id)}
                      disabled={revokeToken.isPending}
                      className="rounded-md p-1.5 text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-400"
                      title="Revoke"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* step 3: test connection */}
        <section className="mb-8 rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6">
          <StepHeader n={3} title="Verify the connection" icon={Plug} />
          <p className="mt-2 text-[13px] text-muted-foreground">
            Run this one-liner with your token to confirm the SDK can reach the
            API. Then record a real session from your agent.
          </p>
          <div className="mt-4">
            <CodeBlock
              language="bash"
              code={`# Set your token (if not in dev mode)
export REPLAYAI_TOKEN="rai_live_..."

# Record a test session
python3 -c "
from replayai import trace, record_step

with trace('connection-test', project='support-agent', tags=['onboarding']):
    record_step(type='llm_call', name='ping', model='gpt-4o-mini',
                tokens_in=10, tokens_out=5,
                input='ping', output='pong', status='success')
print('Session recorded — check the dashboard')
"`}
              maxHeight="max-h-72"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => testConnection.mutate()}
              disabled={testConnection.isPending}
              className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[12.5px] font-medium text-foreground transition hover:bg-muted/40 disabled:opacity-60"
            >
              {testConnection.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Plug className="h-3.5 w-3.5 text-primary" />
              )}
              {testConnection.isPending ? "Testing…" : "Test API connection"}
            </button>
            {s?.hasSession && (
              <a
                href="/?#demo"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12.5px] font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                View recorded sessions
              </a>
            )}
          </div>
        </section>

        {/* security note */}
        <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-[12px] leading-relaxed text-muted-foreground">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground/90">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Security
          </div>
          Tokens are hashed (SHA-256) at rest — the raw value is shown exactly
          once at creation. Secrets in your agent&apos;s prompts are
          auto-redacted before recording (matching{" "}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">sk-…</code>,{" "}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">Bearer …</code>, and your custom patterns). Revoke
          a token any time; it stops working immediately.
        </div>
      </main>
    </div>
  );
}

function StepHeader({
  n,
  title,
  icon: Icon,
}: {
  n: number;
  title: string;
  icon: typeof KeyRound;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 font-mono text-[14px] font-bold text-primary ring-1 ring-primary/25">
        {n}
      </span>
      <h2 className="text-[17px] font-semibold tracking-tight">{title}</h2>
      <Icon className="ml-auto h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function ProgressStep({
  done,
  label,
  n,
}: {
  done: boolean;
  label: string;
  n: number;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition",
        done
          ? "border-emerald-500/40 bg-emerald-500/[0.07]"
          : "border-border/60 bg-background/40",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
          done
            ? "bg-emerald-500/20 text-emerald-300"
            : "bg-muted text-muted-foreground",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      <span
        className={cn(
          "text-[12.5px] font-medium",
          done ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </div>
  );
}

function InstallCard({
  label,
  cmd,
  onCopy,
}: {
  label: string;
  cmd: string;
  onCopy: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-background/40">
      <div className="border-b border-border/50 px-3 py-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex items-center gap-2 px-3 py-2">
        <code className="flex-1 truncate font-mono text-[11.5px] text-foreground/90">
          {cmd}
        </code>
        <button
          onClick={handle}
          className="shrink-0 rounded p-1 text-muted-foreground transition hover:text-foreground"
          aria-label={`Copy ${label} install command`}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
