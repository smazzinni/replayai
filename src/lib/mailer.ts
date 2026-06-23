// Server-only: transactional email via nodemailer (SMTP).
//
// Used by the "Partner with US" form to deliver submissions to
// info@rioforge.com. SMTP credentials are read from env vars so the same
// code runs in dev (no SMTP → gracefully degrades) and prod (configure
// SMTP_HOST/USER/PASS in the host environment).
//
// This module MUST stay server-only — it imports nodemailer and reads creds.

import type { Transporter } from "nodemailer";
import { PARTNER_EMAIL_TO } from "@/lib/site-config";

let transporter: Transporter | null = null;
let transportConfigured = false;

interface SmtpEnv {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

function readSmtpEnv(): SmtpEnv | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  // Require host + user + pass to consider SMTP "configured". Port + from
  // have sensible defaults.
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT) || 587;
  const from =
    process.env.SMTP_FROM?.trim() ||
    "ReplayAI Partner Program <noreply@replayai.dev>";
  return { host, port, user, pass, from };
}

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  const cfg = readSmtpEnv();
  if (!cfg) return null;
  // Lazy-import so the module loads even when nodemailer isn't installed
  // (e.g. edge preview). In the Next.js server runtime this always resolves.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodemailer = require("nodemailer") as typeof import("nodemailer");
  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: cfg.pass },
  });
  transportConfigured = true;
  return transporter;
}

export interface PartnerSubmission {
  email: string;
  name?: string | null;
  company?: string | null;
  role?: string | null;
  teamSize?: string | null;
  useCase?: string | null;
}

/** Build a readable HTML email body for a partner-program submission. */
function buildPartnerEmailHtml(s: PartnerSubmission): string {
  const row = (label: string, value?: string | null) =>
    `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px;white-space:nowrap">${label}</td>` +
    `<td style="padding:6px 12px;color:#111827;font-size:13px;font-weight:600">${escapeHtml(
      value || "—",
    )}</td></tr>`;
  return `
<div style="font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
  <div style="background:#0a0a0a;color:#fff;padding:18px 24px">
    <div style="font-size:15px;font-weight:700">ReplayAI — New Design Partner Application</div>
    <div style="font-size:12px;color:#9ca3af;margin-top:2px">A new team wants to join the design partner program.</div>
  </div>
  <table style="width:100%;border-collapse:collapse">
    ${row("Email", s.email)}
    ${row("Name", s.name)}
    ${row("Company", s.company)}
    ${row("Role", s.role)}
    ${row("Team size", s.teamSize)}
  </table>
  <div style="padding:14px 24px;border-top:1px solid #f3f4f6">
    <div style="font-size:12px;color:#6b7280;margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">What are they building?</div>
    <div style="font-size:14px;color:#111827;line-height:1.5;white-space:pre-wrap">${escapeHtml(
      s.useCase || "—",
    )}</div>
  </div>
  <div style="padding:12px 24px;background:#f9fafb;font-size:11px;color:#9ca3af">
    Reply directly to this applicant at <a href="mailto:${escapeHtml(
      s.email,
    )}" style="color:#4f46e5">${escapeHtml(s.email)}</a>.
  </div>
</div>`;
}

function buildPartnerEmailText(s: PartnerSubmission): string {
  return [
    "ReplayAI — New Design Partner Application",
    "==========================================",
    "",
    `Email:     ${s.email}`,
    `Name:      ${s.name || "—"}`,
    `Company:   ${s.company || "—"}`,
    `Role:      ${s.role || "—"}`,
    `Team size: ${s.teamSize || "—"}`,
    "",
    "What are they building?",
    s.useCase || "—",
    "",
    `Reply to the applicant: ${s.email}`,
  ].join("\n");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface SendResult {
  ok: boolean;
  delivered: boolean;
  messageId?: string;
  error?: string;
  /** False when SMTP env vars aren't set (dev/preview). */
  smtpConfigured: boolean;
}

/**
 * Deliver a partner-program submission to info@rioforge.com.
 *
 * Returns a SendResult describing what happened. Never throws — callers can
 * treat email delivery as best-effort alongside the DB write.
 */
export async function sendPartnerEmail(
  submission: PartnerSubmission,
): Promise<SendResult> {
  const cfg = readSmtpEnv();
  if (!cfg) {
    // SMTP not configured (dev/preview). Don't fail — the DB row is the
    // source of truth; ops can read pending submissions from /api/waitlist.
    return {
      ok: true,
      delivered: false,
      smtpConfigured: false,
      error: "SMTP not configured (set SMTP_HOST/USER/PASS to enable email)",
    };
  }

  try {
    const transport = getTransporter();
    if (!transport) {
      return { ok: false, delivered: false, smtpConfigured: false, error: "transport unavailable" };
    }
    const info = await transport.sendMail({
      from: cfg.from,
      to: PARTNER_EMAIL_TO,
      replyTo: submission.email,
      subject: `New design partner application — ${submission.company || submission.email}`,
      text: buildPartnerEmailText(submission),
      html: buildPartnerEmailHtml(submission),
    });
    return {
      ok: true,
      delivered: true,
      messageId: info.messageId,
      smtpConfigured: true,
    };
  } catch (err) {
    return {
      ok: false,
      delivered: false,
      smtpConfigured: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** True iff SMTP credentials are present in the environment. */
export function isSmtpConfigured(): boolean {
  return readSmtpEnv() !== null;
}
