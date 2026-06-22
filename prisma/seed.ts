import { PrismaClient } from "@prisma/client";
import {
  SEED_PROJECTS,
  SESSION_PROJECT,
  withRecentTimestamps,
} from "../src/lib/seed-data";

const SEED_SESSIONS = withRecentTimestamps();

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding ReplayAI database…");

  // Wipe in dependency-safe order
  await db.step.deleteMany();
  await db.session.deleteMany();
  await db.project.deleteMany();

  // Projects
  const projectBySlug: Record<string, string> = {};
  for (const p of SEED_PROJECTS) {
    const created = await db.project.create({ data: p });
    projectBySlug[p.slug] = created.id;
    console.log(`  ✓ project ${p.slug} (${created.id})`);
  }

  // Sessions + steps
  for (const s of SEED_SESSIONS) {
    const slug = SESSION_PROJECT[s.id] ?? "support-agent";
    const projectId = projectBySlug[slug];
    if (!projectId) throw new Error(`No project for slug ${slug}`);

    const created = await db.session.create({
      data: {
        id: s.id,
        projectId,
        name: s.name,
        agent: s.agent,
        framework: s.framework,
        status: s.status,
        startedAt: new Date(s.startedAt),
        durationMs: s.durationMs,
        tokenTotal: s.tokenTotal,
        costUsd: s.costUsd,
        tags: s.tags.join(","),
      },
    });

    await db.step.createMany({
      data: s.steps.map((st, i) => ({
        sessionId: created.id,
        order: i,
        type: st.type,
        name: st.name,
        offsetMs: st.t,
        durationMs: st.durationMs,
        status: st.status,
        model: st.model ?? null,
        tokensIn: st.tokensIn ?? null,
        tokensOut: st.tokensOut ?? null,
        input: st.input,
        output: st.output,
      })),
    });

    console.log(
      `  ✓ session ${s.id} · ${s.steps.length} steps · ${s.status}`,
    );
  }

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
