import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processNudge } from "@/lib/nudge";
import { requireCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Cron endpoint — one nudge to people who signed up and never really started.
//   Authorization: Bearer <CRON_SECRET>
// ?dry=1 to preview WITHOUT sending or stamping; ?limit=N to cap per run.
//
// Daily. Each user is stamped once ever (User.nudgeSentAt), so the schedule only decides
// how promptly the nudge lands, never how many someone gets.
async function handle(req: NextRequest) {
  const denied = requireCron(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.max(1, parseInt(limitRaw, 10) || 0) : undefined;

  try {
    const summary = await processNudge(prisma, { dry, limit });
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[cron/nudge]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
