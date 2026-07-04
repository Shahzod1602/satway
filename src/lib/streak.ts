// Daily-practice streak, computed on the Asia/Tashkent calendar (UTC+5, no DST).
// Using UTC days broke streaks unfairly at 05:00 local time: a student practising
// at 01:00 Tashkent (20:00 UTC the day before) would land on the "wrong" day.

const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** The Asia/Tashkent calendar day (YYYY-MM-DD) for an instant. */
export function tashkentDayKey(d: Date): string {
  return new Date(d.getTime() + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Count consecutive Tashkent days with at least one submission, ending today or
 * yesterday (missing *today* only breaks the streak once tomorrow arrives).
 * Tashkent has a constant +5 offset, so stepping back 24h always lands on the
 * previous calendar day.
 */
export function computeStreak(
  submittedAts: (Date | null | undefined)[],
  now: Date = new Date(),
): number {
  const days = new Set(
    submittedAts.filter(Boolean).map((d) => tashkentDayKey(d as Date)),
  );
  let cursor = now.getTime();
  if (!days.has(tashkentDayKey(new Date(cursor)))) cursor -= DAY_MS;
  let streak = 0;
  while (days.has(tashkentDayKey(new Date(cursor)))) {
    streak += 1;
    cursor -= DAY_MS;
  }
  return streak;
}
