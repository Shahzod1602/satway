import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processWinback } from "@/lib/winback";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Cron endpoint — re-engage users whose Premium has expired.
// Protect with CRON_SECRET, passed as:
//   Authorization: Bearer <CRON_SECRET>     (preferred)
//   ?key=<CRON_SECRET>                       (for plain-URL cron services)
// Add ?dry=1 to preview WITHOUT sending/stamping; ?limit=N to cap per run.
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  // Header-only (no ?key= in the URL → keeps the secret out of access logs/Referer),
  // compared in constant time.
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const sb = Buffer.from(secret);
  const pb = Buffer.from(bearer);
  if (pb.length !== sb.length || !crypto.timingSafeEqual(pb, sb)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
