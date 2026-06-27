// Freemium access rules for SAT platform.
// Free tier: Test 1 only (all skills). Everything else needs Premium.

// Welcome gift: every brand-new account (email signup or Telegram) starts with
// a short free Premium trial.
export const WELCOME_PREMIUM_DAYS = 1;

/** Expiry date for the welcome Premium trial, measured from now. */
export function welcomePremiumUntil(): Date {
  return new Date(Date.now() + WELCOME_PREMIUM_DAYS * 24 * 60 * 60 * 1000);
}

export function testSlugMeta(slug: string): {
  testNum: number | null;
} {
  const t = slug.match(/test-?(\d+)/i);
  return { testNum: t ? parseInt(t[1], 10) : null };
}

// Free tier: only Test 1 of any set
export function isTestFree(slug: string): boolean {
  const { testNum } = testSlugMeta(slug);
  if (testNum === null) return true; // custom content
  return testNum === 1;
}

export function isPremiumActive(
  plan: string | null | undefined,
  premiumUntil: Date | string | null | undefined,
): boolean {
  if (plan !== "PREMIUM") return false;
  if (!premiumUntil) return true;
  return new Date(premiumUntil).getTime() > Date.now();
}

export function effectivePlan(
  plan: string | null | undefined,
  premiumUntil: Date | string | null | undefined,
): "PREMIUM" | "FREE" {
  return isPremiumActive(plan, premiumUntil) ? "PREMIUM" : "FREE";
}

// Prefer the explicit Test.isPremium flag; fall back to the slug heuristic when
// only a slug is available (UI hints) or the flag is absent (older callers).
export function canAccessTest(
  plan: string | null | undefined,
  testOrSlug: string | { slug: string; isPremium?: boolean },
): boolean {
  if (plan === "PREMIUM") return true;
  if (typeof testOrSlug === "string") return isTestFree(testOrSlug);
  if (typeof testOrSlug.isPremium === "boolean") return !testOrSlug.isPremium;
  return isTestFree(testOrSlug.slug);
}

export function canAccessMock(plan: string | null | undefined): boolean {
  return plan === "PREMIUM";
}
