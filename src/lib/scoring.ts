// SAT raw-score → scaled score conversion (200–800 per section).
// Digital SAT: Reading & Writing (max 54 raw), Math (max 44 raw).
// These are approximate conversion tables based on College Board practice tests.

type ScoreRow = { min: number; scaled: number };

// Reading & Writing scaled scores (out of 54 raw → 200-800)
// Based on official College Board Digital SAT practice tests
const READING_WRITING: ScoreRow[] = [
  { min: 54, scaled: 800 },
  { min: 53, scaled: 790 },
  { min: 52, scaled: 780 },
  { min: 51, scaled: 760 },
  { min: 50, scaled: 740 },
  { min: 49, scaled: 730 },
  { min: 48, scaled: 710 },
  { min: 47, scaled: 700 },
  { min: 46, scaled: 690 },
  { min: 45, scaled: 680 },
  { min: 44, scaled: 670 },
  { min: 43, scaled: 660 },
  { min: 42, scaled: 650 },
  { min: 41, scaled: 640 },
  { min: 40, scaled: 630 },
  { min: 39, scaled: 620 },
  { min: 38, scaled: 610 },
  { min: 37, scaled: 600 },
  { min: 36, scaled: 590 },
  { min: 35, scaled: 580 },
  { min: 34, scaled: 570 },
  { min: 33, scaled: 560 },
  { min: 32, scaled: 550 },
  { min: 31, scaled: 540 },
  { min: 30, scaled: 530 },
  { min: 29, scaled: 520 },
  { min: 28, scaled: 510 },
  { min: 27, scaled: 500 },
  { min: 26, scaled: 490 },
  { min: 25, scaled: 480 },
  { min: 24, scaled: 470 },
  { min: 23, scaled: 460 },
  { min: 22, scaled: 450 },
  { min: 21, scaled: 440 },
  { min: 20, scaled: 430 },
  { min: 19, scaled: 420 },
  { min: 18, scaled: 410 },
  { min: 17, scaled: 400 },
  { min: 16, scaled: 390 },
  { min: 15, scaled: 380 },
  { min: 14, scaled: 370 },
  { min: 13, scaled: 360 },
  { min: 12, scaled: 350 },
  { min: 11, scaled: 340 },
  { min: 10, scaled: 330 },
  { min: 9, scaled: 320 },
  { min: 8, scaled: 310 },
  { min: 7, scaled: 300 },
  { min: 6, scaled: 290 },
  { min: 5, scaled: 280 },
  { min: 4, scaled: 270 },
  { min: 3, scaled: 260 },
  { min: 2, scaled: 250 },
  { min: 1, scaled: 240 },
  { min: 0, scaled: 200 },
];

// Math scaled scores (out of 44 raw → 200-800)
const MATH: ScoreRow[] = [
  { min: 44, scaled: 800 },
  { min: 43, scaled: 790 },
  { min: 42, scaled: 780 },
  { min: 41, scaled: 770 },
  { min: 40, scaled: 750 },
  { min: 39, scaled: 730 },
  { min: 38, scaled: 720 },
  { min: 37, scaled: 710 },
  { min: 36, scaled: 700 },
  { min: 35, scaled: 690 },
  { min: 34, scaled: 680 },
  { min: 33, scaled: 670 },
  { min: 32, scaled: 660 },
  { min: 31, scaled: 650 },
  { min: 30, scaled: 640 },
  { min: 29, scaled: 620 },
  { min: 28, scaled: 610 },
  { min: 27, scaled: 600 },
  { min: 26, scaled: 590 },
  { min: 25, scaled: 580 },
  { min: 24, scaled: 570 },
  { min: 23, scaled: 560 },
  { min: 22, scaled: 550 },
  { min: 21, scaled: 540 },
  { min: 20, scaled: 530 },
  { min: 19, scaled: 520 },
  { min: 18, scaled: 510 },
  { min: 17, scaled: 500 },
  { min: 16, scaled: 490 },
  { min: 15, scaled: 480 },
  { min: 14, scaled: 470 },
  { min: 13, scaled: 460 },
  { min: 12, scaled: 450 },
  { min: 11, scaled: 440 },
  { min: 10, scaled: 430 },
  { min: 9, scaled: 420 },
  { min: 8, scaled: 410 },
  { min: 7, scaled: 400 },
  { min: 6, scaled: 390 },
  { min: 5, scaled: 380 },
  { min: 4, scaled: 370 },
  { min: 3, scaled: 360 },
  { min: 2, scaled: 350 },
  { min: 1, scaled: 340 },
  { min: 0, scaled: 200 },
];

export type SatSkill = "READING_WRITING" | "MATH";

/**
 * Convert a raw correct count to an SAT scaled score (200–800).
 */
export function rawToScaled(
  raw: number,
  skill: SatSkill,
  total?: number,
): number {
  const table = skill === "MATH" ? MATH : READING_WRITING;
  const maxRaw = skill === "MATH" ? 44 : 54;

  // Scale raw to /44 or /54 equivalent if total differs
  const scaled = total && total !== maxRaw
    ? Math.round((raw / total) * maxRaw)
    : raw;

  for (const row of table) {
    if (scaled >= row.min) return row.scaled;
  }
  return 200;
}

/** Combined total score (400–1600) */
export function totalScore(rwScore: number, mathScore: number): number {
  return rwScore + mathScore;
}

// ─────────────────────────────────────────────────────────────
// Adaptive (two-module) scoring
// ─────────────────────────────────────────────────────────────

export type Module2Difficulty = "EASY" | "HARD";

/**
 * Fraction of Module 1 a test-taker must answer correctly to be routed to the
 * harder Module 2. Mirrors the College Board adaptive design (roughly the top
 * performers see the harder second module).
 */
export const HARD_MODULE_THRESHOLD = 0.6;

/** Decide which Module 2 variant to serve from Module 1 performance. */
export function pickModule2Difficulty(
  module1Raw: number,
  module1Total: number,
): Module2Difficulty {
  if (module1Total <= 0) return "EASY";
  return module1Raw / module1Total >= HARD_MODULE_THRESHOLD ? "HARD" : "EASY";
}

// Relative worth of a Module-2 correct answer by the variant served. Module-1
// items are the reference (weight 1). A correct answer on the HARD second module
// is worth more than on the EASY one — this is what lets the hard path reach 800
// and naturally caps the easy path, mirroring how the real exam equates the forms.
const M2_WEIGHT: Record<Module2Difficulty, number> = { EASY: 0.75, HARD: 1.3 };

/**
 * Scaled score (200–800) for a two-stage adaptive section.
 *
 * The previous version scored a single shared linear table, then hard-clamped the
 * result (EASY ≤ 600, HARD ≥ 510). That produced two bugs the audit flagged: flat
 * "dead zones" where extra correct answers raised nothing, and a ~110-point CLIFF
 * at the routing boundary. This model instead weights each correct answer by the
 * difficulty of the module it came from and normalises against the hard-path
 * ceiling, so the score is strictly monotonic in both modules' raw scores, the
 * EASY path tops out naturally (~660) while only the HARD path can reach 800, and
 * nothing is clamped. Still an approximation — the real exam uses IRT equating.
 */
export function rawToScaledAdaptive(
  module1Raw: number,
  module2Raw: number,
  module1Total: number,
  module2Total: number,
  difficulty: Module2Difficulty,
): number {
  const w = M2_WEIGHT[difficulty];
  const earned = module1Raw + module2Raw * w;
  // Normalise against the HARD-path maximum so only the hard path can reach 800.
  const maxEarned = module1Total + module2Total * M2_WEIGHT.HARD;
  const frac = maxEarned > 0 ? Math.max(0, Math.min(1, earned / maxEarned)) : 0;
  // SAT section scores move in 10-point steps across the 200–800 range.
  const scaled = 200 + Math.round((frac * 600) / 10) * 10;
  return Math.max(200, Math.min(800, scaled));
}
