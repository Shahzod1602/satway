-- analytics_activity — the idea that makes this board useful NEXT WEEK instead of next month.
--
-- The Event table starts empty. If the dashboard read only from it, every chart would say
-- zero on launch day, and an analytics project that shows you nothing for a month gets
-- abandoned before it pays for itself.
--
-- But this app has been recording real usage for its whole life. It just recorded it in
-- seven different tables, in seven different shapes, and never joined them up. This view
-- does that: it unions the new event stream with TestAttempt, ShareLink, ShareLinkUse,
-- LiveSession, LiveParticipant, SupportMessage, Payment and User.createdAt into ONE
-- stream of (user_id, ts, surface, kind).
--
-- Consequence: DAU/MAU, weekly cohort retention, the signup→paid funnel, and adoption of
-- tests / share links / live / support all work RETROACTIVELY, over every row that
-- already exists, from the moment this view is created. Only the genuinely uninstrumented
-- sections start at zero — and that IS the honest picture.
--
-- ─────────────────────────────────────────────────────────────
-- THE ONE RULE: an activity appears here EXACTLY once.
--
-- The Event branch below deliberately EXCLUDES 'ai_call' (that is cost, not activity) and
-- 'signup' / 'checkout' / 'paid' (User and Payment already own those). src/lib/events.ts
-- enforces the other half of the contract: nothing ever emits start/finish for tests,
-- because TestAttempt owns them.
--
-- Break that contract and nothing throws. The board just quietly double-counts, and you
-- cannot see it from the chart. That is the one bug a dashboard cannot survive.
-- ─────────────────────────────────────────────────────────────
--
-- Prisma cannot model a view, so every read goes through prisma.$queryRaw in
-- src/lib/analytics.ts. Never run `prisma db pull` against prod — it does not know this
-- exists and will drop it from the schema.

CREATE OR REPLACE VIEW analytics_activity AS

  -- 1. The new event stream. Only the verbs that carry information no table holds.
  SELECT e."userId" AS user_id, e.ts AS ts, e.surface AS surface, e.name AS kind
    FROM "Event" e
   WHERE e."userId" IS NOT NULL
     AND e.name IN ('view', 'open', 'progress', 'finish', 'blocked', 'login', 'error')

  -- 2. Exams — months of history, already durable.
  --
  --    `module IS NOT NULL` means single-module practice, which is a genuinely different
  --    act from sitting a full adaptive paper: it is untimed-in-spirit, it never produces
  --    a scaled score, and it is excluded from the leaderboard. Counting the two together
  --    would make "tests taken" a number that means nothing.
  UNION ALL
  SELECT a."userId", a."startedAt",
         CASE WHEN a.module IS NOT NULL THEN 'practice_module' ELSE 'tests' END,
         'start'
    FROM "TestAttempt" a

  UNION ALL
  SELECT a."userId", a."submittedAt",
         CASE WHEN a.module IS NOT NULL THEN 'practice_module' ELSE 'tests' END,
         'finish'
    FROM "TestAttempt" a
   WHERE a."submittedAt" IS NOT NULL

  -- 3. Group work, live sessions, support, money, signup.
  UNION ALL SELECT s."createdById", s."createdAt", 'group',   'start'    FROM "ShareLink"       s
  UNION ALL SELECT u."userId",      u."createdAt", 'group',   'finish'   FROM "ShareLinkUse"    u
  UNION ALL SELECT l."hostId",      l."createdAt", 'live',    'start'    FROM "LiveSession"     l
  UNION ALL SELECT p."userId",      p."joinedAt",  'live',    'finish'   FROM "LiveParticipant" p
  UNION ALL SELECT m."userId",      m."createdAt", 'support', 'finish'   FROM "SupportMessage"  m WHERE m."fromAdmin" = false

  -- Payment is manual-approval today: createdAt = the student said "I've paid",
  -- reviewedAt = an admin confirmed the transfer landed. The gap between these two
  -- counts is the manual-payment funnel loss, and it is the number that decides
  -- whether automating checkout is worth building.
  UNION ALL SELECT p."userId",      p."createdAt", 'upgrade', 'checkout' FROM "Payment"         p
  UNION ALL SELECT p."userId",      p."reviewedAt", 'upgrade', 'paid'    FROM "Payment"         p
     WHERE p.status = 'APPROVED' AND p."reviewedAt" IS NOT NULL

  UNION ALL SELECT u.id,            u."createdAt", 'auth',    'signup'   FROM "User"            u;
