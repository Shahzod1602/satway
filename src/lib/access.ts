// Freemium access rules for SAT platform.
// Free tier: Test 1 only (all skills). Everything else needs Premium.

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

export function canAccessTest(plan: string | null | undefined, slug: string): boolean {
  return plan === "PREMIUM" || isTestFree(slug);
}

export function canAccessMock(plan: string | null | undefined): boolean {
  return plan === "PREMIUM";
}
