// The DB half of the streak. The math lives in ./streak.ts and stays pure so it can be
// unit-tested without a database — see streak.test.ts.

import { prisma } from "./prisma";
import { streakAfterSubmission } from "./streak";

/**
 * Fold a completed submission into the student's streak.
 *
 * Idempotent within a Tashkent day: the second, third and tenth submission of the same
 * day all no-op without an UPDATE, so it is safe to call from every terminal branch of
 * the submit route rather than trying to find the one true place.
 *
 * Never throws. A streak is a nice-to-have; a student's score submission is not, and
 * this runs after that transaction has already committed.
 */
export async function recordPractice(userId: string, now: Date = new Date()): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { currentStreak: true, longestStreak: true, lastActiveDay: true },
    });
    if (!user) return;

    const next = streakAfterSubmission(user, now);
    if (!next) return; // already practised today

    // Guard on lastActiveDay: two submissions landing in the same second would otherwise
    // both read the old row and both increment, handing out a streak of 2 for one day.
    await prisma.user.updateMany({
      where: { id: userId, lastActiveDay: user.lastActiveDay },
      data: next,
    });
  } catch (e) {
    console.error("[streak] failed to record practice:", (e as Error).message);
  }
}
