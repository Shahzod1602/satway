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

/** The longest run of consecutive Tashkent days in a submission history. */
export function computeLongestStreak(submittedAts: (Date | null | undefined)[]): number {
  const days = [
    ...new Set(submittedAts.filter(Boolean).map((d) => tashkentDayKey(d as Date))),
  ].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of days) {
    run = prev !== null && day === nextDay(prev) ? run + 1 : 1;
    if (run > best) best = run;
    prev = day;
  }
  return best;
}

/** The Tashkent day after `key`. Safe across months — it goes through a real Date. */
function nextDay(key: string): string {
  return new Date(new Date(`${key}T00:00:00Z`).getTime() + DAY_MS).toISOString().slice(0, 10);
}

/**
 * What User.currentStreak actually means today.
 *
 * The stored value was true as of lastActiveDay and nothing rewrites it when the student
 * stops showing up — so a row can say 5 forever. Reading it raw would render a streak
 * that has been dead for a month, which is the one thing a streak must never do: it is a
 * commitment device, and a fake one destroys the mechanic.
 *
 * Active today or yesterday → the stored value stands (missing today only breaks the
 * streak once tomorrow arrives). Older → it is 0.
 */
export function effectiveStreak(
  currentStreak: number | null | undefined,
  lastActiveDay: string | null | undefined,
  now: Date = new Date(),
): number {
  if (!currentStreak || !lastActiveDay) return 0;
  const today = tashkentDayKey(now);
  const yesterday = tashkentDayKey(new Date(now.getTime() - DAY_MS));
  return lastActiveDay === today || lastActiveDay === yesterday ? currentStreak : 0;
}

/**
 * The new streak state after a submission lands. Pure — the caller writes it.
 *
 * Returns null when nothing changed (already practised today), so the caller can skip
 * the UPDATE entirely: most submissions are the second, third or tenth of the same day.
 */
export function streakAfterSubmission(
  prev: { currentStreak: number; longestStreak: number; lastActiveDay: string | null },
  now: Date = new Date(),
): { currentStreak: number; longestStreak: number; lastActiveDay: string } | null {
  const today = tashkentDayKey(now);
  if (prev.lastActiveDay === today) return null;

  const yesterday = tashkentDayKey(new Date(now.getTime() - DAY_MS));
  const currentStreak = prev.lastActiveDay === yesterday ? prev.currentStreak + 1 : 1;
  return {
    currentStreak,
    longestStreak: Math.max(prev.longestStreak, currentStreak),
    lastActiveDay: today,
  };
}
