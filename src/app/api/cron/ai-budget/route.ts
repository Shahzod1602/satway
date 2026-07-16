import { NextRequest, NextResponse } from "next/server";
import { checkAiBudget } from "@/lib/aiBudget";
import { requireCron } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cron endpoint — watch today's AI spend and alert before the invoice does.
//   Authorization: Bearer <CRON_SECRET>
// Add ?dry=1 to see what WOULD fire without sending or claiming the alert.
//
// Meant to run every ~15 minutes. Each alert is claimed once per (day, kind, target),
// so a frequent schedule costs nothing but catches a runaway within the quarter hour.
async function handle(req: NextRequest) {
  const denied = requireCron(req);
  if (denied) return denied;

  const dry = new URL(req.url).searchParams.get("dry") === "1";

  try {
    const summary = await checkAiBudget({ dry });
    return NextResponse.json({ ok: true, dry, ...summary });
  } catch (e) {
    console.error("[cron/ai-budget]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

export const GET = handle;
export const POST = handle;
