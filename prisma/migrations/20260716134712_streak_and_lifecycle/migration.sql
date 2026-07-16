-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastActiveDay" TEXT,
ADD COLUMN     "longestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "nudgeSentAt" TIMESTAMP(3),
ADD COLUMN     "welcomeSentAt" TIMESTAMP(3);

-- ─────────────────────────────────────────────────────────────
-- Backfill the streak from history.
--
-- Without this every existing student's streak silently resets to 0 the moment these
-- columns start being read. A streak is a commitment device: zeroing a real 12-day run
-- because of a schema change is worse than never having shipped the feature.
--
-- The whole thing is derivable — TestAttempt.submittedAt has always been there. This is
-- the same gaps-and-islands calculation src/lib/streak.ts does in TypeScript, on the
-- Asia/Tashkent calendar (+5, no DST), which is why the day key is
-- (submittedAt + 5 hours)::date rather than a bare ::date.
-- ─────────────────────────────────────────────────────────────

WITH days AS (
  -- One row per (student, Tashkent day they submitted anything).
  SELECT DISTINCT
         a."userId" AS user_id,
         ((a."submittedAt" + interval '5 hours')::date) AS day
    FROM "TestAttempt" a
   WHERE a."submittedAt" IS NOT NULL
),
islands AS (
  -- Consecutive days share a constant (day - row_number): the classic gaps-and-islands
  -- trick. A gap shifts the difference, starting a new island.
  SELECT user_id,
         day,
         day - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day))::int AS island
    FROM days
),
runs AS (
  SELECT user_id, island, COUNT(*)::int AS len, MAX(day) AS last_day
    FROM islands
   GROUP BY user_id, island
),
agg AS (
  SELECT r.user_id,
         MAX(r.len) AS longest,
         MAX(r.last_day) AS last_day,
         -- The CURRENT streak is the length of the island that ends on the student's
         -- most recent active day. It is only still "live" if that day is today or
         -- yesterday, but that judgement belongs at read time (effectiveStreak) — the
         -- stored pair is (value, the day it was true).
         (ARRAY_AGG(r.len ORDER BY r.last_day DESC))[1] AS current
    FROM runs r
   GROUP BY r.user_id
)
UPDATE "User" u
   SET "currentStreak" = agg.current,
       "longestStreak" = agg.longest,
       "lastActiveDay" = to_char(agg.last_day, 'YYYY-MM-DD')
  FROM agg
 WHERE u.id = agg.user_id;
