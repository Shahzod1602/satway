// The closed vocabulary the analytics board is built on.
//
// Deliberately prisma-free and dependency-free so a client component can import it
// without dragging the server runtime into the browser bundle.
//
// Both sets are CLOSED on purpose. Free-form strings in an events table look harmless
// for a week and then you have `tutor`, `ai_tutor`, `Tutor` and `tutor-chat` in the
// same column, no way to know which is which, and a GROUP BY that quietly answers the
// wrong question. If you add a section to the product, add it here first.

/** Every section of the product a user can spend time in. */
export const SURFACES = [
  // Core exam
  "tests", // /test/[slug] — one adaptive paper (R&W or Math)
  "mock", // /mock — R&W + Math back to back, scored on the 1600 scale
  "results", // /results/[id] — the score report
  // AI. The only thing here that costs money per use, so it is never merged into
  // the page it renders on: the tutor is a cost centre, /results is a pageview.
  "tutor", // <TutorChat> — per-question Socratic doubt-solver
  // Study support
  "review", // /review — the mistake bank
  "progress",
  "vocabulary",
  "dashboard",
  "home",
  "leaderboard",
  // Social / commercial
  "group", // /shares + /s/[token] — share links
  "live", // /live/[code] — host-controlled synchronised sessions
  "referral",
  "upgrade",
  "support",
  "profile",
  "auth", // login / register / welcome gate
  // Not user surfaces — where the money goes when WE spend it, not when they do.
  "admin", // admin actions
  "admin_media", // admin content ingest: AI question generation
  "telegram", // the bot
  "script", // an offline script (scripts/*) — see origin=SCRIPT
] as const;

export type Surface = (typeof SURFACES)[number];

const SURFACE_SET: ReadonlySet<string> = new Set(SURFACES);
export const isSurface = (s: string): s is Surface => SURFACE_SET.has(s);

/**
 * The closed verb set.
 *
 * `start`, `signup`, `checkout` and `paid` are emitted ONLY by the analytics_activity
 * VIEW, reading from TestAttempt / User / Payment. Nothing ever writes them into
 * Event — those tables already own those facts, and writing them twice is exactly how
 * a dashboard starts double-counting. They live in this list so the VIEW's `kind`
 * column and Event.name share one vocabulary.
 */
export const EVENT_NAMES = [
  "view", // opened a section (deduped — this is not a pageview firehose)
  "open", // opened a specific item (a test, a question)
  "progress", // got N% through an item
  "finish", // completed something that has a completion
  "blocked", // hit a paywall / a quota / the follow gate  ← the ONLY unbiased demand signal
  "login",
  "ai_call", // a paid model call — carries the cost columns
  "error", // a paid path failed
  // VIEW-only, never emitted:
  "start",
  "signup",
  "checkout",
  "paid",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];

/** Names that emit() will accept. The four VIEW-only verbs are not among them. */
export const EMITTABLE: ReadonlySet<string> = new Set([
  "view",
  "open",
  "progress",
  "finish",
  "blocked",
  "login",
  "ai_call",
  "error",
]);

/**
 * Where the money came from.
 *
 * The single most important distinction on the cost board: `USER` is cost of goods
 * sold — it scales with your users and eats your margin. `ADMIN` and `SCRIPT` are
 * content CAPEX — a question bank generated once. Mixing them makes every per-user
 * cost figure wrong, and it is the reason "my Gemini bill is $400" is not an
 * actionable sentence.
 */
export const ORIGINS = ["USER", "ADMIN", "SCRIPT", "CRON", "BOT"] as const;
export type Origin = (typeof ORIGINS)[number];

/** Reasons a `blocked` event fires. Closed, for the same reason surfaces are. */
export const BLOCK_REASONS = {
  PREMIUM_REQUIRED: "premium_required",
  RATE_LIMIT: "rate_limit",
  GATE_REQUIRED: "gate_required", // the Instagram/Telegram follow gate
} as const;

/** Label for the board. Keep it short — these are table rows, not prose. */
export const SURFACE_LABEL: Record<Surface, string> = {
  tests: "Practice tests",
  mock: "Full mock",
  results: "Score report",
  tutor: "AI tutor",
  review: "Mistake bank",
  progress: "Progress",
  vocabulary: "Vocabulary",
  dashboard: "Dashboard",
  home: "Home",
  leaderboard: "Leaderboard",
  group: "Share links",
  live: "Live sessions",
  referral: "Referral",
  upgrade: "Upgrade",
  support: "Support",
  profile: "Profile",
  auth: "Auth",
  admin: "Admin",
  admin_media: "Admin — question generation",
  telegram: "Telegram bot",
  script: "Offline script",
};

/**
 * URL path → surface, for the client beacon.
 *
 * An unknown path returns null and emits NOTHING. That is the cardinality guard: the
 * beacon is a public endpoint, and a caller who can put arbitrary strings in the
 * `surface` column can fill the table with junk in an afternoon.
 */
export function pathToSurface(pathname: string): Surface | null {
  const p = pathname.split("?")[0].replace(/\/+$/, "") || "/";
  if (p === "/") return "home";

  const seg = p.split("/")[1] ?? "";
  const direct: Record<string, Surface> = {
    home: "home",
    dashboard: "dashboard",
    test: "tests",
    mock: "mock",
    results: "results",
    review: "review",
    progress: "progress",
    vocabulary: "vocabulary",
    leaderboard: "leaderboard",
    shares: "group",
    s: "group", // /s/[token] — redeeming a share link
    live: "live",
    referral: "referral",
    upgrade: "upgrade",
    support: "support",
    profile: "profile",
    login: "auth",
    register: "auth",
    welcome: "auth",
    "forgot-password": "auth",
    admin: "admin",
  };
  return direct[seg] ?? null;
}
