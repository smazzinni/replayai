"use client";

import { cn } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Loader2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface WaitlistResult {
  entry: { id: string; email: string; status: string };
  position: number;
  message: string;
}

export function WaitlistForm() {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    email: "",
    name: "",
    company: "",
    role: "",
    teamSize: "",
    useCase: "",
  });

  const submit = useMutation({
    mutationFn: async (): Promise<WaitlistResult> => {
      const r = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const b = await r.json();
      if (!r.ok) throw new Error(b.error ?? "Failed to join");
      return b as WaitlistResult;
    },
    onSuccess: (data) => {
      setSubmitted(true);
      toast.success("You're on the list!", {
        description: data.message,
      });
    },
    onError: (e) =>
      toast.error("Couldn't join waitlist", {
        description: e instanceof Error ? e.message : "Unknown error",
      }),
  });

  const update = (k: keyof typeof form, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  if (submitted) {
    return (
      <div className="overflow-hidden rounded-2xl border border-emerald-500/40 bg-emerald-500/[0.06] p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15">
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </div>
        <h3 className="text-[18px] font-semibold tracking-tight">
          You&apos;re on the list
        </h3>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          We&apos;ll reach out to <span className="font-mono text-foreground">{form.email}</span> with
          early access. In the meantime, the free tier is yours — record your
          first session today.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <a
            href="/?view=setup"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-[12.5px] font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Set up the SDK <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <a
            href="/?view=developers&doc=quickstart"
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[12.5px] font-medium text-foreground transition hover:bg-muted/40"
          >
            Read the quickstart
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/50 backdrop-blur">
      <div className="flex items-center gap-2 border-b border-border/60 bg-background/30 px-5 py-3">
        <Users className="h-4 w-4 text-primary" />
        <span className="text-[13px] font-semibold tracking-tight">
          Join the design partner program
        </span>
        <span className="ml-auto rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
          Free Pro for 12 months
        </span>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
        className="grid gap-3 p-5 sm:grid-cols-2"
      >
        <Field
          label="Work email"
          required
          value={form.email}
          onChange={(v) => update("email", v)}
          placeholder="you@company.com"
          type="email"
        />
        <Field
          label="Name"
          value={form.name}
          onChange={(v) => update("name", v)}
          placeholder="Ada Lovelace"
        />
        <Field
          label="Company"
          value={form.company}
          onChange={(v) => update("company", v)}
          placeholder="Acme AI"
        />
        <Field
          label="Role"
          value={form.role}
          onChange={(v) => update("role", v)}
          placeholder="Staff Engineer"
        />
        <SelectField
          label="Team size"
          value={form.teamSize}
          onChange={(v) => update("teamSize", v)}
          options={[
            { value: "", label: "Select…" },
            { value: "1-5", label: "1–5" },
            { value: "6-20", label: "6–20" },
            { value: "21-100", label: "21–100" },
            { value: "100+", label: "100+" },
          ]}
        />
        <div className="sm:col-span-2">
          <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            What are you building?
          </label>
          <textarea
            value={form.useCase}
            onChange={(e) => update("useCase", e.target.value)}
            placeholder="e.g. A LangChain support agent that needs reproducible debugging…"
            rows={2}
            className="w-full resize-none rounded-md border border-border/60 bg-background/40 px-3 py-2 text-[13px] outline-none transition focus:border-primary/60"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submit.isPending || !form.email}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60 sm:w-auto"
          >
            {submit.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Joining…
              </>
            ) : (
              <>
                Join the waitlist <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </button>
          <p className="mt-2 text-[11px] text-muted-foreground">
            We&apos;ll only use this to send you access. No spam, ever.
          </p>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label} {required && <span className="text-primary">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="h-9 w-full rounded-md border border-border/60 bg-background/40 px-3 text-[13px] outline-none transition focus:border-primary/60"
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-md border border-border/60 bg-background/40 px-3 text-[13px] outline-none transition focus:border-primary/60"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
