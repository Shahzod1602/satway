// The only writer of the Event table.
//
// TWO CONTRACTS, and the difference between them is the whole design:
//
//   emit()          usage.  Synchronous. Buffered. Batched. DROPPABLE.
//                   A page render must never pay for a database round-trip, and losing
//                   a second of pageviews on a deploy costs nothing. It returns void
//                   and it CANNOT throw — telemetry that can fail a request is worse
//                   than no telemetry.
//
//   recordAiCall()  money.  Awaited. NOT droppable.
//                   One INSERT sitting next to a 2-20 second model call is ~0.05%
//                   overhead, and this row is the ledger — lifetime margin, the whale
//                   table, and the invoice reconciliation all read it. A dropped cost
//                   row is a permanently wrong number, not a missing pixel.
//
// It writes to the same Postgres the app already uses. No Redis, no queue, no second
// container: every one of those is a thing that silently stops running and shows you
// zeros, which is indistinguishable from "nobody uses this feature".

import { prisma } from "./prisma";
import { PRICE_REV, priceUsdMicros, type TokenCounts } from "./aiPricing";
import { EMITTABLE, type Origin, type Surface } from "./surfaces";

type Row = Record<string, unknown>;

const BUF: Row[] = [];
const MAX_BUF = 2000; // hard ceiling — telemetry must never eat the heap
const FLUSH_AT = 100; // rows
const FLUSH_MS = 1000;
let timer: NodeJS.Timeout | null = null;
let sinkOk: boolean | null = null;

const clampInt = (v: unknown, lo: number, hi: number): number | null => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(lo, Math.min(hi, n));
};

export interface EmitInput {
  surface: Surface;
  key?: string;
  itemId?: string | null;
  userId?: string | null;
  plan?: string;
  origin?: Origin;
  ms?: number | null;
  pct?: number | null;
  ok?: boolean;
  props?: Record<string, unknown> | null;
}

/**
 * Record a usage event. Fire and forget.
 *
 * NOTE the emit contract, which the analytics_activity VIEW depends on: never emit a
 * fact that already has a durable home. No `start`/`finish` on tests (TestAttempt owns
 * those); no `signup`/`checkout`/`paid` (User and Payment own those). Breaking this
 * does not throw — it silently DOUBLE-COUNTS, which is the one bug a dashboard cannot
 * survive, because you cannot see it from the chart.
 */
export function emit(name: string, e: EmitInput): void {
  try {
    if (process.env.EVENTS_DISABLED === "1") return;
    if (!EMITTABLE.has(name)) {
      // A typo'd verb would sit in the table forever, in a bucket nothing queries.
      console.error(`[events] refusing unknown event name: ${name}`);
      return;
    }
    if (BUF.length >= MAX_BUF) return; // drop, don't grow

    BUF.push({
      ts: new Date(),
      name,
      surface: e.surface,
      key: e.key ?? "",
      itemId: e.itemId ?? null,
      userId: e.userId ?? null,
      plan: e.plan ?? "",
      origin: e.origin ?? "USER",
      ms: clampInt(e.ms, 0, 86_400_000),
      pct: clampInt(e.pct, 0, 100),
      ok: e.ok ?? true,
      props: e.props ?? undefined,
    });

    if (BUF.length >= FLUSH_AT) {
      void flush();
      return;
    }
    if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS);
  } catch {
    /* telemetry must never fail a request */
  }
}

export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!BUF.length) return;
  const rows = BUF.splice(0, BUF.length);

  try {
    await prisma.event.createMany({ data: rows as never });
    if (sinkOk !== true) {
      sinkOk = true;
      console.log("[events] sink ready");
    }
  } catch (err) {
    if (sinkOk !== false) {
      sinkOk = false;
      // Load-bearing, not decoration. If the migration has not been applied, createMany
      // throws, this catch swallows it, and the app records NOTHING while looking
      // perfectly healthy — you would find out weeks later, from an empty dashboard.
      console.error("[events] sink UNAVAILABLE:", (err as Error).message);
    }
    // ONE poison row — an FK violation from a user who deleted their account while an
    // event about them sat in the buffer — must not take 99 good rows down with it.
    await Promise.allSettled(rows.map((r) => prisma.event.create({ data: r as never })));
  }
  // Deliberately NO retry queue. A retry loop against a database that is already
  // struggling is how telemetry takes down the app it was meant to observe.
}

// Best effort only. Next's standalone server registers its OWN SIGTERM handler and
// calls process.exit(), so this can lose the race. The design does not depend on it:
// cost rows never enter this buffer, and the loss window is <1s of pageviews.
if (typeof process !== "undefined" && process.once) {
  process.once("SIGTERM", () => void flush());
  process.once("SIGINT", () => void flush());
}

/** Has the sink ever succeeded in this process? Drives the dashboard's health banner. */
export const eventSinkOk = (): boolean | null => sinkOk;

// ─────────────────────────────────────────────────────────────
// The cost ledger
// ─────────────────────────────────────────────────────────────

export interface AiCallInput extends TokenCounts {
  surface: Surface;
  model: string;
  userId?: string | null;
  plan?: string;
  origin?: Origin;
  attemptId?: string | null;
  itemId?: string | null;
  ms?: number | null;
  retries?: number | null;
  cacheHit?: boolean;
  ok?: boolean;
  /** usdMicros came from a floor rather than real usageMetadata. */
  estimated?: boolean;
  /** Overrides the token-derived price. */
  usdMicrosOverride?: number | null;
  props?: Record<string, unknown> | null;
}

/**
 * Record one paid model call. Awaited, and never silently dropped.
 *
 * Prices at WRITE time from the typed token columns, and stamps the rate-card revision
 * that did it — so when a rate turns out wrong, the history is re-priceable with one
 * UPDATE instead of being landfill.
 */
export async function recordAiCall(input: AiCallInput): Promise<void> {
  try {
    if (process.env.EVENTS_DISABLED === "1") return;

    const fromTokens = priceUsdMicros(input.model, input);
    const usdMicros = input.usdMicrosOverride ?? fromTokens;

    await prisma.event.create({
      data: {
        name: "ai_call",
        surface: input.surface,
        key: input.model, // GROUP BY key gives you spend-by-model for free
        itemId: input.itemId ?? null,
        userId: input.userId ?? null,
        plan: input.plan ?? "",
        origin: input.origin ?? "SCRIPT", // no attribution context = it came from a script.
        // ^ This default is a tripwire, not a guess: `origin='SCRIPT'` spend from inside
        //   the container must stay ~$0. If it grows, someone added an AI call without
        //   passing an origin and the cost is landing in nobody's column.
        ms: clampInt(input.ms, 0, 86_400_000),
        ok: input.ok ?? true,
        model: input.model,
        inTextTok: clampInt(input.inTextTok, 0, 2_000_000_000),
        inAudioTok: clampInt(input.inAudioTok, 0, 2_000_000_000),
        inCachedTok: clampInt(input.inCachedTok, 0, 2_000_000_000),
        outTextTok: clampInt(input.outTextTok, 0, 2_000_000_000),
        outAudioTok: clampInt(input.outAudioTok, 0, 2_000_000_000),
        thinkTok: clampInt(input.thinkTok, 0, 2_000_000_000),
        images: clampInt(input.images, 0, 1000),
        usdMicros: clampInt(usdMicros, 0, 2_000_000_000),
        priceRev: PRICE_REV,
        cacheHit: input.cacheHit ?? false,
        estimated: input.estimated ?? false,
        retries: clampInt(input.retries, 0, 100),
        attemptId: input.attemptId ?? null,
        props: (input.props ?? undefined) as never,
      },
    });
  } catch (err) {
    // The ledger must not be able to break a student's tutor reply. If the row cannot
    // be written, shout into the log — but hand the answer back.
    console.error("[events] recordAiCall FAILED:", (err as Error).message);
  }
}

/**
 * Somebody wanted this and was turned away.
 *
 * The single most valuable event in the system, because raw usage cannot answer "what
 * do people want". Usage is biased by the paywall: the tutor 403s for free users, mock
 * is Premium-only, every test past Test 1 is locked. The features people want MOST
 * therefore show up as the features used LEAST, and a dashboard built on usage alone
 * would tell you to delete exactly what you should be selling.
 *
 * `blocked` inverts that. It counts intent instead of access.
 *
 * ⚠️ Must be emitted BEFORE any redirect() — redirect() throws, so a line after it
 * never runs. emit() is synchronous and buffered, so putting it first costs nothing.
 */
export function blocked(
  surface: Surface,
  e: { userId?: string | null; plan?: string; reason: string; itemId?: string | null },
): void {
  emit("blocked", {
    surface,
    key: e.reason, // premium_required | rate_limit | gate_required
    userId: e.userId ?? null,
    plan: e.plan ?? "FREE",
    itemId: e.itemId ?? null,
    ok: false,
  });
}
