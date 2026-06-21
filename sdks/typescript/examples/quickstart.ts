// @smazzinni/sdk — quickstart demo.
//
// A self-contained runnable demo. Defines two fake agent helpers (no real
// LLM — just canned data + a sleep), wraps the flow in `withTrace`, records
// each step via `recordStep`, and POSTs the session to the running ReplayAI
// API at http://localhost:3000. Prints the resulting session URL.
//
// Run with:  bun examples/quickstart.ts
//        or:  npx tsx examples/quickstart.ts
//        or:  node --loader ts-node/esm examples/quickstart.ts

import {
  withTrace,
  recordStep,
  configure,
  currentSession,
  ReplaySession,
  VERSION,
} from "../src/index.js";

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const MESSAGE = "I was charged twice for my subscription, please refund.";

// ---- Fake agent helpers (no real LLM calls) ----

interface Intent {
  intent: string;
  confidence: number;
}

async function classifyIntent(message: string): Promise<Intent> {
  await recordStep({
    type: "llm_call",
    name: "classify_intent",
    model: "gpt-4o-mini",
    tokensIn: 312,
    tokensOut: 24,
    input: `User: ${message}`,
    output: "intent: billing_dispute, confidence: 0.94",
    status: "success",
    durationMs: 120,
  });
  await sleep(120);
  return { intent: "billing_dispute", confidence: 0.94 };
}

interface Customer {
  customerId: string;
  name: string;
  plan: string;
}

async function lookupCustomer(message: string): Promise<Customer> {
  await recordStep({
    type: "tool_call",
    name: "lookup_customer",
    input: JSON.stringify({ q: message }),
    output: JSON.stringify({ customerId: "cus_8f31", name: "Priya Patel", plan: "pro" }),
    status: "success",
    durationMs: 90,
  });
  await sleep(90);
  return { customerId: "cus_8f31", name: "Priya Patel", plan: "pro" };
}

async function issueRefund(customerId: string, amount: number): Promise<{ refundId: string }> {
  await recordStep({
    type: "tool_call",
    name: "issue_refund",
    input: JSON.stringify({ customerId, amount }),
    output: JSON.stringify({ refundId: "ref_3391", amount }),
    status: "success",
    durationMs: 80,
  });
  await sleep(80);
  return { refundId: "ref_3391" };
}

async function draftResponse(intent: string, customer: Customer): Promise<string> {
  const reply = `Hi ${customer.name}, I've issued a $19 refund to your account (refund ID: ref_3391). It will appear in 3–5 business days.`;
  await recordStep({
    type: "llm_call",
    name: "draft_response",
    model: "gpt-4o-mini",
    tokensIn: 528,
    tokensOut: 96,
    input: JSON.stringify({ intent, customer }),
    output: reply,
    status: "success",
    durationMs: 140,
  });
  await sleep(140);
  return reply;
}

// ---- Demo ----

async function main(): Promise<void> {
  // Point at the running ReplayAI app.
  configure({ apiUrl: "http://localhost:3000" });

  console.log(`@smazzinni/sdk v${VERSION} — quickstart`);
  console.log(`Agent: demo-agent-ts`);
  console.log(`Project: support-agent`);
  console.log(`Message: "${MESSAGE}"`);
  console.log("");

  let finalReply = "";
  // Capture the session via currentSession() inside the trace; after
  // withTrace returns, the flush result is stashed on session.__flushResult.
  let session: ReturnType<typeof currentSession> = undefined;
  await withTrace(
    "demo-agent-ts",
    { project: "support-agent", tags: ["sdk-demo"], framework: "Custom" },
    async () => {
      session = currentSession();
      const intent = await classifyIntent(MESSAGE);
      const customer = await lookupCustomer(MESSAGE);
      await issueRefund(customer.customerId, 19);
      finalReply = await draftResponse(intent.intent, customer);
    },
  );

  console.log("");
  console.log(`Agent reply: ${finalReply}`);

  const flush = session?.__flushResult;
  if (flush?.ok && flush.url) {
    console.log("");
    console.log(`✓ Session recorded.`);
    console.log(`  Session URL: ${flush.url}`);
    console.log(`  Session ID:  ${flush.sessionId}`);
    console.log("");

    // Bonus: round-trip through ReplaySession to prove the SDK can also read.
    const replay = new ReplaySession(flush.sessionId);
    const trace = await replay.load();
    console.log(`✓ ReplaySession.load() loaded ${trace.stepCount} steps (status: ${trace.status}).`);

    const code = await replay.export("pytest");
    const preview = code.split("\n").slice(0, 4).join("\n");
    console.log(`✓ ReplaySession.export("pytest") returned ${code.length} chars.`);
    console.log(`  Preview:\n${preview.split("\n").map((l) => `    ${l}`).join("\n")}`);
  } else {
    console.log("");
    console.error(`✗ Recording failed: ${flush?.error ?? "unknown error"}`);
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error("[quickstart] fatal:", err);
  process.exit(1);
});
