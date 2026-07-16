// The rate card. One place that knows what a Gemini call costs.
//
// Satway defaults to gemini-2.5-pro (see src/lib/env.ts), which is the most expensive
// text model on the card: $1.25/Mtok in and $10.00/Mtok out — 4x flash on both sides.
// A flat two-rate estimator would under-report the tutor by that multiple, and the
// tutor is the only thing here that costs money per use. Price it by model or do not
// bother pricing it.
//
// Verified against ai.google.dev/gemini-api/docs/pricing (paid tier, July 2026).
// These are still a MODEL, not the bill — which is why AiBillMonth exists and why
// every cost screen prints the drift against the real invoice.

/**
 * Bump this whenever a rate below changes.
 *
 * Every Event row stores the rev that priced it, so when a rate turns out wrong you
 * re-price the entire history with ONE UPDATE instead of throwing the history away.
 * This only works because the token counts are typed columns rather than a JSON blob.
 */
export const PRICE_REV = "v1-2026-07";

export type Rate = {
  inText: number; // USD per 1M input tokens (text / image / video)
  inAudio: number; // USD per 1M input tokens (audio)
  inCached: number; // USD per 1M cached input tokens
  outText: number; // USD per 1M output tokens. THINKING TOKENS BILL AT THIS RATE.
  outAudio: number; // USD per 1M output tokens (audio)
  perImage?: number; // USD per generated image (image models bill per image, not per token)
};

const DEFAULTS: Record<string, Rate> = {
  // The default model. Thinking is ON unless a call opts out — and thinking tokens
  // bill at the $10 output rate, so a "short" tutor reply is not necessarily cheap.
  "gemini-2.5-pro": { inText: 1.25, inAudio: 1.25, inCached: 0.125, outText: 10.0, outAudio: 0 },
  "gemini-2.5-flash": { inText: 0.3, inAudio: 1.0, inCached: 0.03, outText: 2.5, outAudio: 0 },
  "gemini-2.5-flash-lite": { inText: 0.1, inAudio: 0.3, inCached: 0.01, outText: 0.4, outAudio: 0 },
  "gemini-2.5-flash-preview-tts": { inText: 0.5, inAudio: 0, inCached: 0, outText: 0, outAudio: 10.0 },
  "gemini-2.5-flash-image": {
    inText: 0.3,
    inAudio: 0,
    inCached: 0,
    outText: 2.5,
    outAudio: 0,
    perImage: 0.039,
  },
};

/**
 * AI_RATES_JSON lets you correct a rate ON THE SERVER, without a redeploy, the
 * afternoon the invoice says you got one wrong. Merged over DEFAULTS, per model.
 *   AI_RATES_JSON={"gemini-2.5-pro":{"outText":12}}
 */
let cardCache: Record<string, Rate> | null = null;
function card(): Record<string, Rate> {
  if (cardCache) return cardCache;
  const out: Record<string, Rate> = { ...DEFAULTS };
  try {
    const raw = process.env.AI_RATES_JSON;
    if (raw) {
      const over = JSON.parse(raw) as Record<string, Partial<Rate>>;
      for (const [model, patch] of Object.entries(over)) {
        out[model] = { ...(out[model] ?? DEFAULTS["gemini-2.5-pro"]), ...patch };
      }
    }
  } catch {
    console.error("[aiPricing] AI_RATES_JSON is not valid JSON — using defaults");
  }
  cardCache = out;
  return out;
}

/**
 * Exact match, then longest-prefix, then fall back to the default model.
 *
 * The prefix rule is what keeps a dated preview id ("gemini-2.5-pro-preview-06-05")
 * from silently falling through to the fallback and mispricing a call by 4x.
 */
export function resolveRate(model: string): Rate {
  const c = card();
  if (c[model]) return c[model];
  let best: string | null = null;
  for (const k of Object.keys(c)) {
    if (model.startsWith(k) && (best === null || k.length > best.length)) best = k;
  }
  // Fall back to the PRICIEST plausible text model, not the cheapest. An unknown id is
  // far more likely to be a new premium model than a bargain, and a cost board that
  // guesses low is the one failure mode that makes you leave a leak open.
  return best ? c[best] : c["gemini-2.5-pro"];
}

export type TokenCounts = {
  inTextTok?: number | null;
  inAudioTok?: number | null;
  inCachedTok?: number | null;
  outTextTok?: number | null;
  outAudioTok?: number | null;
  thinkTok?: number | null;
  images?: number | null;
};

/**
 * Price one call, in integer micro-USD.
 *
 * Integer, not float: a float column of money accumulates binary-fraction error over
 * a million rows, and SUM()ing it gives you a number that is nearly right, which is
 * the worst kind. 1 µUSD granularity, max ~$2,147 per row — no single call is close.
 */
export function priceUsdMicros(model: string, t: TokenCounts): number {
  const r = resolveRate(model);
  const n = (v: number | null | undefined) => (Number.isFinite(v) ? Math.max(0, Number(v)) : 0);

  const usd =
    (n(t.inTextTok) / 1e6) * r.inText +
    (n(t.inAudioTok) / 1e6) * r.inAudio +
    (n(t.inCachedTok) / 1e6) * r.inCached +
    // Thinking tokens bill as output. On 2.5-pro that is $10/Mtok, and thinking is on
    // by default — for a reasoning-heavy SAT math explanation it can dwarf the reply.
    ((n(t.outTextTok) + n(t.thinkTok)) / 1e6) * r.outText +
    (n(t.outAudioTok) / 1e6) * r.outAudio +
    n(t.images) * (r.perImage ?? 0);

  return Math.round(usd * 1e6);
}

export const usd = (micros: number | null | undefined): number => (micros ?? 0) / 1e6;

/** "$1.23" / "$0.0041" — small numbers must not all render as "$0.00". */
export function fmtUsd(micros: number | null | undefined): string {
  const v = usd(micros);
  if (v === 0) return "$0";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  if (v < 1) return `$${v.toFixed(3)}`;
  return `$${v.toFixed(2)}`;
}
