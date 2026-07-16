// Spaced repetition for the vocabulary decks — a Leitner box system.
//
// Pure functions only, no DB: the scheduling is the part worth testing, and it should be
// testable without a database. See srs.test.ts.
//
// Leitner rather than SM-2 on purpose. SM-2 tunes a per-card ease factor from a 0-5
// self-graded quality score; this deck asks a multiple-choice question with exactly two
// outcomes, so there is no quality signal to feed it. A box system is what the available
// data actually supports, and pretending otherwise would just be arithmetic theatre.

/**
 * Days until a word in each box comes back.
 *
 * Box 0 is "just got it wrong" — same day, because a word you have just failed is the one
 * worth seeing again now. The tail is deliberately long: the SAT is months away, and a
 * word you have recalled five times over two months does not need weekly drilling.
 */
export const SRS_INTERVALS_DAYS = [0, 1, 3, 7, 21, 60] as const;

export const MAX_BOX = SRS_INTERVALS_DAYS.length - 1;

/** A word is "learned" once it has survived to the long intervals. */
export const LEARNED_BOX = 3;

export type ReviewState = {
  box: number;
  dueAt: Date;
  correctCount: number;
  wrongCount: number;
  lastReviewedAt: Date;
};

/**
 * Where a word goes after one answer.
 *
 * Correct → up one box. Wrong → all the way back to 0, not down one: half-remembering a
 * word is the state that produces a wrong answer on test day, and a gentle demotion lets
 * a word you keep failing drift back up to a 3-week interval anyway.
 */
export function nextReview(
  prev: { box: number; correctCount: number; wrongCount: number } | null,
  correct: boolean,
  now: Date = new Date(),
): ReviewState {
  const prevBox = prev?.box ?? 0;
  const box = correct ? Math.min(MAX_BOX, prevBox + 1) : 0;

  const dueAt = new Date(now.getTime() + SRS_INTERVALS_DAYS[box] * 86_400_000);

  return {
    box,
    dueAt,
    correctCount: (prev?.correctCount ?? 0) + (correct ? 1 : 0),
    wrongCount: (prev?.wrongCount ?? 0) + (correct ? 0 : 1),
    lastReviewedAt: now,
  };
}

export type WordStatus = "new" | "learning" | "learned";

export function statusOf(p: { box: number } | null | undefined): WordStatus {
  if (!p) return "new";
  return p.box >= LEARNED_BOX ? "learned" : "learning";
}

/** Is this word due to be reviewed? A word never seen is always due. */
export function isDue(p: { dueAt: Date | string } | null | undefined, now: Date = new Date()): boolean {
  if (!p) return true;
  return new Date(p.dueAt).getTime() <= now.getTime();
}

/**
 * Pick the review queue: everything due, hardest first.
 *
 * Lowest box first means the words you keep failing lead the session, while attention is
 * freshest — the opposite order would spend it on words already in the 60-day box.
 */
export function dueQueue<T extends { wordId: string }>(
  words: T[],
  progress: Map<string, { box: number; dueAt: Date | string }>,
  now: Date = new Date(),
): T[] {
  return words
    .filter((w) => isDue(progress.get(w.wordId), now))
    .sort((a, b) => (progress.get(a.wordId)?.box ?? 0) - (progress.get(b.wordId)?.box ?? 0));
}
