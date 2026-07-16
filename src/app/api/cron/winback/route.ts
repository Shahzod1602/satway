import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processWinback } from "@/lib/winback";
import { requireCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Cron endpoint — re-engage users whose Premium has expired.
//   Authorization: Bearer <CRON_SECRET>
// Add ?dry=1 to preview WITHOUT sending/stamping; ?limit=N to cap per run.
async function handle(req: NextRequest) {
  const denied = requireCron(req);
  if (denied) return denied;

  const url = new URL(req.url);
  const dry = url.searchParams.get("dry") === "1";
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.max(1, parseInt(limitRaw, 10) || 0) : undefined;

  try {
    const summary = await processWinback(prisma, { dry, limit });
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    console.error("[cron/winback]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
