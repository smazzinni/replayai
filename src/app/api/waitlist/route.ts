import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** List waitlist entries (admin view). */
export async function GET() {
  const entries = await db.waitlistEntry.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      company: true,
      role: true,
      teamSize: true,
      useCase: true,
      status: true,
      createdAt: true,
    },
  });
  return NextResponse.json({
    entries,
    count: entries.length,
    pending: entries.filter((e) => e.status === "pending").length,
    invited: entries.filter((e) => e.status === "invited").length,
    onboarded: entries.filter((e) => e.status === "onboarded").length,
  });
}

/** Join the design-partner waitlist. */
export async function POST(req: NextRequest) {
  let body: {
    email?: string;
    name?: string;
    company?: string;
    role?: string;
    teamSize?: string;
    useCase?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 },
    );
  }

  // Upsert: if the email already exists, update their details but keep status.
  const entry = await db.waitlistEntry.upsert({
    where: { email },
    update: {
      name: body.name?.trim() || undefined,
      company: body.company?.trim() || undefined,
      role: body.role?.trim() || undefined,
      teamSize: body.teamSize || undefined,
      useCase: body.useCase?.trim() || undefined,
    },
    create: {
      email,
      name: body.name?.trim() || null,
      company: body.company?.trim() || null,
      role: body.role?.trim() || null,
      teamSize: body.teamSize || null,
      useCase: body.useCase?.trim() || null,
    },
    select: {
      id: true,
      email: true,
      status: true,
      createdAt: true,
    },
  });

  // Forward the design-partner signup to Rioforge.com (fire-and-forget).
  try {
    await fetch("https://rioforge.com/api/contact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: email,
        name: body.name?.trim() || "—",
        company: body.company?.trim() || "—",
        message: [
          "ReplayAI Design Partner Program Signup",
          "",
          "Name: " + (body.name?.trim() || "—"),
          "Email: " + email,
          "Company: " + (body.company?.trim() || "—"),
          "Role: " + (body.role?.trim() || "—"),
          "Team size: " + (body.teamSize || "—"),
          "Use case: " + (body.useCase?.trim() || "—"),
        ].join("\n"),
      }),
    });
  } catch {
    // Rioforge may be down; local signup still succeeds.
  }

  const position =
    (await db.waitlistEntry.count({
      where: { createdAt: { lte: entry.createdAt } },
    })) ;

  return NextResponse.json(
    {
      entry,
      position,
      message:
        entry.status === "pending"
          ? `You're on the list! You're #${position} in line.`
          : `You're already ${entry.status}.`,
    },
    { status: 201 },
  );
}
