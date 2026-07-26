// Every query the analytics board runs.
//
// All of it goes through $queryRaw, for one reason: the most valuable object here is a
// VIEW (analytics_activity), and Prisma cannot model a view. See the migration
// prisma/migrations/20260716140000_analytics_activity_view.
//
// ⚠️ BIGINT. Postgres COUNT() and SUM() come back as JavaScript BigInt, and passing data
//    from a server component to a client one serialises it — which THROWS on BigInt.
//    Every aggregate below is therefore Number()'d before it leaves this file. Add a
//    query, forget this, and the page dies with "Do not know how to serialize a BigInt".

import { prisma } from "./prisma";
import { SURFACES, SURFACE_LABEL } from "./surfaces";

const SURFACE_LABELS: Record<string, string> = SURFACE_LABEL;

const n = (v: unknown): number => Number(v ?? 0);

/**
 * "Now", in the same domain as the timestamps we compare it against.
 *
 * Prisma stores DateTime as `timestamp(3)` WITHOUT time zone, holding a UTC value. Plain
 * `now()` returns a `timestamptz`. Comparing the two makes Postgres reinterpret our naive
 * UTC column as LOCAL time — and this product's server runs on Asia/Tashkent (+05); see
 * src/lib/streak.ts, which deliberately builds the streak in that zone.
 *
 * So `ts >= date_trunc('day', now())` would shift every stored timestamp five hours
 * earlier while the day boundary stays put. The result: for the first five hours of every
 * day, "spend today" silently reads $0. Not obviously broken — briefly, quietly,
 * confidently wrong, which is worse.
 *
 * Fix: compare naive-UTC to naive-UTC. Never write a bare now() in this file.
 */
const NOW = "(now() AT TIME ZONE 'utc')";

// ─────────────────────────────────────────────────────────────
// The 30-second morning glance
// ─────────────────────────────────────────────────────────────

export interface Glance {
  mau: number; // distinct users active in 30d (from the VIEW — real, historical)
  wau: number;
  dau: number;
  newUsers7d: number;
  spendTodayUsd: number;
  spendMonthUsd: number;
  spendPrevMonthUsd: number;
  budgetUsd: number;
  aiErrors7d: number;
  invoiceUsd: number | null; // the real Google bill for the last reconciled month
  invoiceMonth: string | null;
  invoiceEstimatedUsd: number; // what WE thought that month cost
}

export async function getGlance(): Promise<Glance> {
  const [act, spend, errs, bill] = await Promise.all([
    prisma.$queryRawUnsafe<{ mau: bigint; wau: bigint; dau: bigint; new7: bigint }[]>(`
      SELECT
        COUNT(DISTINCT user_id) FILTER (WHERE ts > ${NOW} - interval '30 days') AS mau,
        COUNT(DISTINCT user_id) FILTER (WHERE ts > ${NOW} - interval '7 days')  AS wau,
        COUNT(DISTINCT user_id) FILTER (WHERE ts > ${NOW} - interval '1 day')   AS dau,
        COUNT(*) FILTER (WHERE kind = 'signup' AND ts > ${NOW} - interval '7 days') AS new7
      FROM analytics_activity
    `),
    prisma.$queryRawUnsafe<{ today: bigint; month: bigint; prev: bigint }[]>(`
      SELECT
        COALESCE(SUM("usdMicros") FILTER (WHERE ts >= date_trunc('day',   ${NOW})), 0) AS today,
        COALESCE(SUM("usdMicros") FILTER (WHERE ts >= date_trunc('month', ${NOW})), 0) AS month,
        COALESCE(SUM("usdMicros") FILTER (
          WHERE ts >= date_trunc('month', ${NOW}) - interval '1 month'
            AND ts <  date_trunc('month', ${NOW})), 0)                                 AS prev
      FROM "Event" WHERE name = 'ai_call'
    `),
    prisma.$queryRawUnsafe<{ c: bigint }[]>(`
      SELECT COUNT(*) AS c FROM "Event"
       WHERE name = 'ai_call' AND ok = false AND ts > ${NOW} - interval '7 days'
    `),
    prisma.$queryRawUnsafe<{ month: string; cents: number; est: bigint }[]>(`
      SELECT b.month,
             b."actualUsdCents" AS cents,
             COALESCE((SELECT SUM(e."usdMicros") FROM "Event" e
                        WHERE e.name = 'ai_call'
                          AND to_char(e.ts, 'YYYY-MM') = b.month), 0) AS est
        FROM "AiBillMonth" b
       ORDER BY b.month DESC
       LIMIT 1
    `),
  ]);

  const s = spend[0];
  return {
    mau: n(act[0]?.mau),
    wau: n(act[0]?.wau),
    dau: n(act[0]?.dau),
    newUsers7d: n(act[0]?.new7),
    spendTodayUsd: n(s?.today) / 1e6,
    spendMonthUsd: n(s?.month) / 1e6,
    spendPrevMonthUsd: n(s?.prev) / 1e6,
    budgetUsd: Number(process.env.AI_MONTHLY_BUDGET_USD || 0),
    aiErrors7d: n(errs[0]?.c),
    invoiceUsd: bill[0] ? n(bill[0].cents) / 100 : null,
    invoiceMonth: bill[0]?.month ?? null,
    invoiceEstimatedUsd: bill[0] ? n(bill[0].est) / 1e6 : 0,
  };
}

// ─────────────────────────────────────────────────────────────
// The retention question — the one that actually decides the roadmap
// ─────────────────────────────────────────────────────────────

export interface Retention {
  cohortUsers: number; // signed up in the window
  returnedDay1: number; // last seen AFTER joined + 24h (ever came back, not strictly "on day 1")
  returnedDay7: number; // last seen after joined + 7 days
  oneAndDone: number; // active on exactly one day, ever  ← the headline number
  oneAndDonePct: number;
}

/**
 * How many people show up once and never return.
 *
 * This is deliberately the first thing on the board. The sister app ran for months
 * before anyone measured it and the answer was 90% — at which point every feature
 * argument that had been had was moot, because nothing downstream of "they never come
 * back" matters. Measure it before building anything else.
 */
export async function getRetention(days = 90): Promise<Retention> {
  const rows = await prisma.$queryRawUnsafe<
    { cohort: bigint; d1: bigint; d7: bigint; once: bigint }[]
  >(`
    WITH cohort AS (
      SELECT user_id, MIN(ts) AS joined
        FROM analytics_activity
       WHERE kind = 'signup' AND ts > ${NOW} - interval '${days} days'
       GROUP BY user_id
    ),
    activity AS (
      SELECT c.user_id,
             c.joined,
             COUNT(DISTINCT date_trunc('day', a.ts)) AS active_days,
             MAX(a.ts) AS last_seen
        FROM cohort c
        JOIN analytics_activity a ON a.user_id = c.user_id
       GROUP BY c.user_id, c.joined
    )
    SELECT COUNT(*) AS cohort,
           COUNT(*) FILTER (WHERE last_seen > joined + interval '1 day') AS d1,
           COUNT(*) FILTER (WHERE last_seen > joined + interval '7 days') AS d7,
           COUNT(*) FILTER (WHERE active_days <= 1) AS once
      FROM activity
  `);

  const r = rows[0];
  const cohortUsers = n(r?.cohort);
  const oneAndDone = n(r?.once);
  return {
    cohortUsers,
    returnedDay1: n(r?.d1),
    returnedDay7: n(r?.d7),
    oneAndDone,
    oneAndDonePct: cohortUsers > 0 ? (oneAndDone / cohortUsers) * 100 : 0,
  };
}

// ─────────────────────────────────────────────────────────────
// The funnel — where the money leaks
// ─────────────────────────────────────────────────────────────

export interface FunnelRow {
  signups: number;
  tookATest: number;
  hitAPaywall: number;
  startedCheckout: number;
  paid: number;
}

/**
 * signup → test → paywall → checkout → paid, over a window.
 *
 * `startedCheckout` vs `paid` is the manual-payment loss: today a student clicks "I've
 * paid", we create a PENDING row, and an admin has to eyeball a Telegram screenshot
 * before Premium is granted. The gap between those two columns is the cost of NOT having
 * an automated provider — which is the number that decides whether wiring one is worth it.
 */
export async function getFunnel(days = 30): Promise<FunnelRow> {
  const rows = await prisma.$queryRawUnsafe<
    { signups: bigint; tested: bigint; blocked: bigint; checkout: bigint; paid: bigint }[]
  >(`
    SELECT
      COUNT(DISTINCT user_id) FILTER (WHERE kind = 'signup')   AS signups,
      COUNT(DISTINCT user_id) FILTER (WHERE kind = 'start' AND surface IN ('tests','practice_module')) AS tested,
      COUNT(DISTINCT user_id) FILTER (WHERE kind = 'blocked')  AS blocked,
      COUNT(DISTINCT user_id) FILTER (WHERE kind = 'checkout') AS checkout,
      COUNT(DISTINCT user_id) FILTER (WHERE kind = 'paid')     AS paid
    FROM analytics_activity
   WHERE ts > ${NOW} - interval '${days} days'
  `);

  const r = rows[0];
  return {
    signups: n(r?.signups),
    tookATest: n(r?.tested),
    hitAPaywall: n(r?.blocked),
    startedCheckout: n(r?.checkout),
    paid: n(r?.paid),
  };
}

// ─────────────────────────────────────────────────────────────
// The Section Board — what people use, and what they were denied
// ─────────────────────────────────────────────────────────────

export interface SectionRow {
  surface: string;
  label: string;
  users30d: number;
  mauPct: number;
  events30d: number;
  /**
   * Hits on a paywall / quota / gate.
   *
   * THE most important column here. Raw usage is biased by the paywall: the tutor 403s
   * for free users, mock is Premium-only, every test past Test 1 is locked — so the
   * sections people want MOST currently read as the sections used LEAST. `blocked` is
   * the only unbiased read on demand: it counts people who tried and were turned away.
   */
  blocked30d: number;
  usd30d: number;
  usdPerUser: number;
  /** Does this section write a durable row when used? If not, its numbers are FLOORS. */
  instrumented: boolean;
}

/**
 * Sections that produce a durable row today (via the VIEW or a blocked/ai_call emit),
 * and therefore have honest numbers from day one. Everything else reads 0 until it is
 * instrumented — and the board must SAY so, or a 0 gets read as "nobody wanted it"
 * rather than "nobody measured it", and the wrong features get deleted.
 */
const MEASURED_TODAY: ReadonlySet<string> = new Set([
  "tests", // TestAttempt, via the view
  "practice_module", // TestAttempt where module IS NOT NULL
  "tutor", // ai_call + blocked rows
  "mock", // blocked rows
  "group", // ShareLink / ShareLinkUse
  "live", // LiveSession / LiveParticipant
  "support", // SupportMessage
  "upgrade", // Payment
  "auth", // User.createdAt
  "admin_media", // ai_call rows from question generation
]);

export async function getSectionBoard(): Promise<{ rows: SectionRow[]; mau: number }> {
  const [usage, blockedRows, cost, mauRow] = await Promise.all([
    prisma.$queryRawUnsafe<{ surface: string; users: bigint; events: bigint }[]>(`
      SELECT surface, COUNT(DISTINCT user_id) AS users, COUNT(*) AS events
        FROM analytics_activity
       WHERE ts > ${NOW} - interval '30 days'
       GROUP BY surface
    `),
    prisma.$queryRawUnsafe<{ surface: string; c: bigint }[]>(`
      SELECT surface, COUNT(*) AS c FROM "Event"
       WHERE name = 'blocked' AND ts > ${NOW} - interval '30 days'
       GROUP BY surface
    `),
    prisma.$queryRawUnsafe<{ surface: string; usd: bigint }[]>(`
      SELECT surface, COALESCE(SUM("usdMicros"), 0) AS usd FROM "Event"
       WHERE name = 'ai_call' AND ts > ${NOW} - interval '30 days'
       GROUP BY surface
    `),
    prisma.$queryRawUnsafe<{ mau: bigint }[]>(`
      SELECT COUNT(DISTINCT user_id) AS mau FROM analytics_activity
       WHERE ts > ${NOW} - interval '30 days'
    `),
  ]);

  const mau = n(mauRow[0]?.mau);
  const uMap = new Map(usage.map((r) => [r.surface, r]));
  const bMap = new Map(blockedRows.map((r) => [r.surface, n(r.c)]));
  const cMap = new Map(cost.map((r) => [r.surface, n(r.usd) / 1e6]));

  // 'practice_module' is a view-only surface (it is not a page you can navigate to), so
  // it is not in SURFACES. Union it in explicitly rather than letting it vanish.
  const all = [...SURFACES, "practice_module"];

  const rows: SectionRow[] = all.map((surface) => {
    const u = uMap.get(surface);
    const users30d = n(u?.users);
    const usd30d = cMap.get(surface) ?? 0;
    return {
      surface,
      label: surface === "practice_module" ? "Single-module practice" : SURFACE_LABELS[surface] ?? surface,
      users30d,
      mauPct: mau > 0 ? (users30d / mau) * 100 : 0,
      events30d: n(u?.events),
      blocked30d: bMap.get(surface) ?? 0,
      usd30d,
      usdPerUser: users30d > 0 ? usd30d / users30d : 0,
      instrumented: MEASURED_TODAY.has(surface),
    };
  });

  rows.sort((a, b) => b.users30d - a.users30d || b.blocked30d - a.blocked30d);
  return { rows, mau };
}

// ─────────────────────────────────────────────────────────────
// Spend
// ─────────────────────────────────────────────────────────────

export interface SpendByKey {
  key: string;
  usd: number;
  calls: number;
}

export interface DailySpend {
  day: string;
  usd: number;
}

export async function getSpend(days = 30) {
  const byGroup = (col: string) =>
    prisma.$queryRawUnsafe<{ key: string; usd: bigint; calls: bigint }[]>(`
      SELECT ${col} AS key, COALESCE(SUM("usdMicros"), 0) AS usd, COUNT(*) AS calls
        FROM "Event"
       WHERE name = 'ai_call' AND ts > ${NOW} - interval '${days} days'
       GROUP BY ${col} ORDER BY 2 DESC
    `);

  const [daily, bySurface, byModel, byOrigin] = await Promise.all([
    prisma.$queryRawUnsafe<{ day: Date; usd: bigint }[]>(`
      SELECT date_trunc('day', ts) AS day, COALESCE(SUM("usdMicros"), 0) AS usd
        FROM "Event"
       WHERE name = 'ai_call' AND ts > ${NOW} - interval '${days} days'
       GROUP BY 1 ORDER BY 1
    `),
    byGroup(`surface`),
    byGroup(`COALESCE(model, '?')`),
    byGroup(`origin`),
  ]);

  const map = (rows: { key: string; usd: bigint; calls: bigint }[]): SpendByKey[] =>
    rows.map((r) => ({ key: r.key, usd: n(r.usd) / 1e6, calls: n(r.calls) }));

  return {
    daily: zeroFillDays(
      daily.map((r) => ({
        day: new Date(r.day).toISOString().slice(0, 10),
        usd: n(r.usd) / 1e6,
      })) as DailySpend[],
      days,
    ),
    bySurface: map(bySurface),
    byModel: map(byModel),
    byOrigin: map(byOrigin),
  };
}

/**
 * Fill the gaps between the first and last spend days with zero-value rows.
 *
 * The SQL above only emits a row for days that HAD spend, so a quiet weekday is simply
 * absent from the array — and recharts then draws a smooth line straight across the gap,
 * which visually turns "no spend" into "average spend". Padding the missing calendar days
 * with `usd: 0` makes the chart honest.
 */
function zeroFillDays(daily: DailySpend[], days: number): DailySpend[] {
  if (daily.length === 0) return daily;
  // Build the full calendar window (oldest of [first spend day, window start] → today).
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const windowStart = new Date(today);
  windowStart.setUTCDate(windowStart.getUTCDate() - (days - 1));
  const first = new Date(daily[0].day + "T00:00:00Z");
  const start = first < windowStart ? first : windowStart;

  const byDay = new Map(daily.map((d) => [d.day, d.usd]));
  const out: DailySpend[] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const key = cursor.toISOString().slice(0, 10);
    out.push({ day: key, usd: byDay.has(key) ? (byDay.get(key) as number) : 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────
// Cost per user — the whale table
// ─────────────────────────────────────────────────────────────

export interface WhaleRow {
  userId: string;
  name: string;
  email: string;
  plan: string;
  usd30d: number;
  calls30d: number;
  paidUzs: number;
  /** Margin = LIFETIME revenue (UZS→USD) minus 30-DAY AI cost.
   *
   * The two windows deliberately differ: pairing a 30d cost against a 30d revenue would
   * flatter anyone who bought a 6-month plan (their revenue lands in one lump, spread
   * across months of cost). Lifetime revenue vs recent cost is the conservative read —
   * it asks "has this account ever paid for what it is spending lately?". The page label
   * must say exactly that, or the number reads as a mismatch. */
  marginUsd: number;
}

/**
 * Who costs the most, and whether they have ever paid.
 *
 * Revenue is converted at a fixed rate rather than joined to a provider column, because
 * every Payment here is a manual UZS card transfer — there is no provider and no
 * currency field. If an automated provider lands, this is the first query to revisit.
 */
export async function getWhales(limit = 30): Promise<WhaleRow[]> {
  const uzsPerUsd = Number(process.env.UZS_PER_USD || 12000);
  const rows = await prisma.$queryRawUnsafe<
    {
      userId: string;
      name: string;
      email: string;
      plan: string;
      usd: bigint;
      calls: bigint;
      paid: bigint;
    }[]
  >(`
    SELECT e."userId" AS "userId",
           u.name, u.email, u.plan::text AS plan,
           COALESCE(SUM(e."usdMicros"), 0) AS usd,
           COUNT(*) AS calls,
           COALESCE((SELECT SUM(p.amount) FROM "Payment" p
                      WHERE p."userId" = e."userId" AND p.status = 'APPROVED'), 0) AS paid
      FROM "Event" e
      JOIN "User" u ON u.id = e."userId"
     WHERE e.name = 'ai_call'
       AND e."userId" IS NOT NULL
       AND e.origin = 'USER'
       AND e.ts > ${NOW} - interval '30 days'
     GROUP BY e."userId", u.name, u.email, u.plan
     ORDER BY usd DESC
     LIMIT ${Math.max(1, Math.min(200, Math.trunc(limit)))}
  `);

  return rows.map((r) => {
    const usd30d = n(r.usd) / 1e6;
    const paidUzs = n(r.paid);
    return {
      userId: r.userId,
      name: r.name,
      email: r.email,
      plan: r.plan,
      usd30d,
      calls30d: n(r.calls),
      paidUzs,
      marginUsd: paidUzs / uzsPerUsd - usd30d,
    };
  });
}

// ─────────────────────────────────────────────────────────────
// Content quality — free, from rows we already write
// ─────────────────────────────────────────────────────────────

export interface SuspectQuestion {
  questionId: string;
  testTitle: string;
  testSlug: string;
  prompt: string;
  answered: number;
  correctPct: number;
  tutorCalls: number;
}

/**
 * Questions almost everybody gets wrong.
 *
 * Below ~20% correct on a 4-option MCQ is worse than random guessing, which is not a
 * hard question — it is very often a WRONG ANSWER KEY. Given that most of this bank is
 * synthetic (prisma/generate-tests.ts says so out loud), this is the cheapest content-QA
 * signal available, and it costs nothing: the rows are already there.
 *
 * `tutorCalls` sharpens it: a bad key plus students repeatedly asking the tutor about
 * that exact question is a strong tell.
 */
export async function getSuspectQuestions(limit = 20, minAnswers = 10): Promise<SuspectQuestion[]> {
  return (
    await prisma.$queryRawUnsafe<
      {
        questionId: string;
        testTitle: string;
        testSlug: string;
        prompt: string;
        answered: bigint;
        correct: bigint;
        tutor: bigint;
      }[]
    >(`
    SELECT aa."questionId" AS "questionId",
           t.title AS "testTitle",
           t.slug  AS "testSlug",
           LEFT(q.prompt, 140) AS prompt,
           COUNT(*) AS answered,
           COUNT(*) FILTER (WHERE aa."isCorrect") AS correct,
           COALESCE((SELECT COUNT(*) FROM "Event" e
                      WHERE e.name = 'ai_call' AND e.surface = 'tutor'
                        AND e."itemId" = aa."questionId"), 0) AS tutor
      FROM "AttemptAnswer" aa
      JOIN "Question" q ON q.id = aa."questionId"
      JOIN "Section"  s ON s.id = q."sectionId"
      JOIN "Test"     t ON t.id = s."testId"
     GROUP BY aa."questionId", t.title, t.slug, q.prompt
    HAVING COUNT(*) >= ${Math.max(1, Math.trunc(minAnswers))}
       AND (COUNT(*) FILTER (WHERE aa."isCorrect"))::float8 / COUNT(*) < 0.2
     ORDER BY tutor DESC, answered DESC
     LIMIT ${Math.max(1, Math.min(200, Math.trunc(limit)))}
  `)
  ).map((r) => ({
    questionId: r.questionId,
    testTitle: r.testTitle,
    testSlug: r.testSlug,
    prompt: r.prompt,
    answered: n(r.answered),
    correctPct: n(r.answered) > 0 ? (n(r.correct) / n(r.answered)) * 100 : 0,
    tutorCalls: n(r.tutor),
  }));
}

/** Has any AI cost ever been recorded? Drives the board's health banner.
 *
 * Counts `ai_call` rows specifically, not every Event — a single non-AI event (e.g. a
 * blocked emit) must NOT hide the "every cost figure reads $0" explanation. */
export async function eventSinkReady(): Promise<boolean> {
  const r = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT COUNT(*) AS c FROM "Event" WHERE name = 'ai_call'`,
  );
  return n(r[0]?.c) > 0;
}

// ─────────────────────────────────────────────────────────────
// Recent budget alerts — what the watchdog has already fired today
// ─────────────────────────────────────────────────────────────

export interface AlertRow {
  day: string;
  kind: string;
  target: string;
}

/** Alerts fired in the last 14 days, newest first.
 *
 * The cron fires these via Telegram (claim/release dedup in aiBudget.ts), but the board
 * never showed them — so an admin looking at the page had no way to see what the watchdog
 * had already complained about. This closes that loop. */
export async function getRecentAlerts(limit = 50): Promise<AlertRow[]> {
  const rows = await prisma.$queryRawUnsafe<
    { day: string; kind: string; target: string }[]
  >(`
    SELECT day, kind, target FROM "AiAlert"
     WHERE day >= to_char(${NOW} - interval '14 days', 'YYYY-MM-DD')
     ORDER BY day DESC, kind, target
     LIMIT ${Math.max(1, Math.min(200, Math.trunc(limit)))}
  `);
  return rows.map((r) => ({ day: r.day, kind: r.kind, target: r.target }));
}

// ─────────────────────────────────────────────────────────────
// Invoice history — every reconciled month, not just the latest
// ─────────────────────────────────────────────────────────────

export interface BillRow {
  month: string;
  actualUsd: number;
  estimatedUsd: number;
}

/** The last N reconciled invoices with the rate-card estimate alongside, for the board.
 *
 * Each row pairs the real Google invoice (`AiBillMonth.actualUsdCents`) with what the rate
 * card thought that month cost (sum of `ai_call.usdMicros` for that month). The drift
 * between the two is the whole reason `priceRev` is stamped on every Event row: when the
 * rate card is wrong, history can be re-priced rather than thrown away. */
export async function getBillHistory(limit = 12): Promise<BillRow[]> {
  const rows = await prisma.$queryRawUnsafe<
    { month: string; cents: number; est: bigint }[]
  >(`
    SELECT b.month,
           b."actualUsdCents" AS cents,
           COALESCE((SELECT SUM(e."usdMicros") FROM "Event" e
                      WHERE e.name = 'ai_call'
                        AND to_char(e.ts, 'YYYY-MM') = b.month), 0) AS est
      FROM "AiBillMonth" b
     ORDER BY b.month DESC
     LIMIT ${Math.max(1, Math.min(48, Math.trunc(limit)))}
  `);
  return rows.map((r) => ({
    month: r.month,
    actualUsd: n(r.cents) / 100,
    estimatedUsd: n(r.est) / 1e6,
  }));
}
