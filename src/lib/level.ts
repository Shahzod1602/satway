import type { TestLevel } from "@/generated/prisma/enums";

// Whole-test difficulty bands. Tests carry one (admin-set); students carry one
// (self-selected, seeded from a suggestion) and the dashboard matches the two.

export const TEST_LEVELS = ["EASY", "MEDIUM", "HARD"] as const;

export const LEVEL_LABEL: Record<TestLevel, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

/** Badge colours — greenish → amber → rose as difficulty climbs. */
export const LEVEL_BADGE: Record<TestLevel, string> = {
  EASY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 border-amber-200",
  HARD: "bg-rose-50 text-rose-700 border-rose-200",
};

export function isTestLevel(v: unknown): v is TestLevel {
  return v === "EASY" || v === "MEDIUM" || v === "HARD";
}

/**
 * Suggest a starting level for a student.
 *
 * Performance is the real signal: a best total SAT score (400–1600) maps to a band.
 * With no attempts yet we fall back to the target score — but a target is aspirational,
 * so we bias LOW (a beginner aiming for 1500 is still a beginner). No signal at all →
 * MEDIUM, the neutral middle the student can adjust in one tap.
 */
export function suggestLevel(input: {
  bestTotal?: number | null;
  targetTotal?: number | null;
}): TestLevel {
  const best = input.bestTotal ?? null;
  if (best != null) {
    if (best < 1000) return "EASY";
    if (best < 1250) return "MEDIUM";
    return "HARD";
  }
  const target = input.targetTotal ?? null;
  if (target != null) {
    // One band gentler than where the target itself would land.
    if (target < 1250) return "EASY";
    return "MEDIUM";
  }
  return "MEDIUM";
}
