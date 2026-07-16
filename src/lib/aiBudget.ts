// The watchdog on the only bill that can grow without anybody deciding it should.
//
// The tutor is Premium-gated and rate-limited at 30 calls / 10 min per user. That is a
// cap on ABUSE, not on SPEND: 30 calls of gemini-2.5-pro with thinking on is roughly
// $0.70 per user per 10 minutes, and nothing anywhere notices if a hundred people do it
// on the same afternoon. This is what notices.

import { prisma } from "./prisma";
import { notifyAdmin } from "./telegram";

const NOW = "(now() AT TIME ZONE 'utc')"; // see src/lib/analytics.ts — never a bare now()

export type Alert = {
  kind: string;
  target: string;
  message: string;
};

export interface BudgetSummary {
  dailyUsd: number;
  monthUsd: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  alerts: Alert[];
  sent: number;
}

/**
 * Fire each alert at most once per (day, kind, target).
 *
 * Without this the cron re-sends the same "80% of budget" message every 15 minutes for
 * the rest of the day, and the next person to see a budget alert ignores it — which is
 * the same as not having alerts, except it also costs you Telegram rate limit.
 */
async function claimAlert(day: string, kind: string, target: string): Promise<boolean> {
  try {
    await prisma.aiAlert.create({ data: { day, kind, target } });
    return true;
  } catch {
    return false; // unique violation → already fired today
  }
}

/**
 * Give the claim back after a failed send.
 *
 * Claiming BEFORE sending is what stops two overlapping ticks from double-alerting. But
 * a claim that survives a failed send is worse than no dedup at all: the alert is burned
 * for the day and the message never arrives, so a blown budget looks exactly like a quiet
 * one. Release it and the next tick retries in 15 minutes.
 */
async function releaseAlert(day: string, kind: string, target: string): Promise<void> {
  try {
    await prisma.aiAlert.deleteMany({ where: { day, kind, target } });
  } catch {
    /* the next tick will find it claimed and skip — logged by the caller either way */
  }
}

export async function checkAiBudget(opts: { dry?: boolean } = {}): Promise<BudgetSummary> {
  const monthlyBudgetUsd = Number(process.env.AI_MONTHLY_BUDGET_USD || 0);
  // A daily budget derived from the monthly one, so there is one number to configure.
  const dailyBudgetUsd =
    Number(process.env.AI_DAILY_BUDGET_USD || 0) || (monthlyBudgetUsd > 0 ? monthlyBudgetUsd / 30 : 0);

  const [totals, spikes] = await Promise.all([
    prisma.$queryRawUnsafe<{ today: bigint; month: bigint }[]>(`
      SELECT
        COALESCE(SUM("usdMicros") FILTER (WHERE ts >= date_trunc('day',   ${NOW})), 0) AS today,
        COALESCE(SUM("usdMicros") FILTER (WHERE ts >= date_trunc('month', ${NOW})), 0) AS month
      FROM "Event" WHERE name = 'ai_call'
    `),
    // One account burning an outsized share of today's spend. Usually a stuck client
    // retry loop rather than a real person — but either way you want to know today,
    // not when the invoice lands.
    prisma.$queryRawUnsafe<{ userId: string; usd: bigint }[]>(`
      SELECT "userId", COALESCE(SUM("usdMicros"), 0) AS usd
        FROM "Event"
       WHERE name = 'ai_call' AND origin = 'USER' AND "userId" IS NOT NULL
         AND ts >= date_trunc('day', ${NOW})
       GROUP BY "userId"
      HAVING COALESCE(SUM("usdMicros"), 0) > ${Math.round(Number(process.env.AI_USER_DAILY_ALERT_USD || 2) * 1e6)}
       ORDER BY usd DESC
       LIMIT 5
    `),
  ]);

  const dailyUsd = Number(totals[0]?.today ?? 0) / 1e6;
  const monthUsd = Number(totals[0]?.month ?? 0) / 1e6;
  const day = new Date().toISOString().slice(0, 10);
  const alerts: Alert[] = [];

  if (dailyBudgetUsd > 0) {
    const pct = (dailyUsd / dailyBudgetUsd) * 100;
    for (const threshold of [100, 80, 50]) {
      if (pct >= threshold) {
        // Only the highest breached threshold is worth a message — 50/80/100 all firing
        // on the same day is three messages saying one thing.
        alerts.push({
          kind: `daily_${threshold}`,
          target: "",
          message:
            `⚠️ SATway AI spend: $${dailyUsd.toFixed(2)} today ` +
            `(${pct.toFixed(0)}% of the $${dailyBudgetUsd.toFixed(2)} daily budget).\n` +
            `This month: $${monthUsd.toFixed(2)}` +
            (monthlyBudgetUsd > 0 ? ` / $${monthlyBudgetUsd.toFixed(2)}` : ""),
        });
        break;
      }
    }
  }

  for (const s of spikes) {
    const usd = Number(s.usd) / 1e6;
    alerts.push({
      kind: "user_spike",
      target: s.userId,
      message: `⚠️ SATway: one account has burned $${usd.toFixed(2)} of AI today (user ${s.userId}).`,
    });
  }

  let sent = 0;
  if (!opts.dry) {
    for (const a of alerts) {
      if (!(await claimAlert(day, a.kind, a.target))) continue; // already fired today
      if (await notifyAdmin(a.message)) {
        sent++;
      } else {
        await releaseAlert(day, a.kind, a.target);
        console.error(
          `[aiBudget] could not deliver alert ${a.kind} — check TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID. Will retry next tick.`,
        );
      }
    }
  }

  return { dailyUsd, monthUsd, dailyBudgetUsd, monthlyBudgetUsd, alerts, sent };
}
