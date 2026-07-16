-- Click SHOP-API: provider state on Payment, plus the two statuses only a provider can
-- produce (a manual transfer is approved or rejected by a human; it is never "cancelled
-- by the gateway" or "reversed after the money moved").

ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'REFUNDED';

ALTER TABLE "Payment"
  ADD COLUMN "clickPrepareId" INTEGER,
  ADD COLUMN "providerRef" TEXT,
  ADD COLUMN "paidAt" TIMESTAMP(3);

-- ── analytics_activity: teach the 'paid' branch about provider payments ─────
--
-- The original view (migration 20260716140000) read reviewedAt, which only exists on
-- manual approvals. A Click payment is confirmed by a webhook and has paidAt instead —
-- without this change every automated sale would be invisible in the funnel, which is
-- exactly the number the provider integration exists to improve.
--
-- Full view text repeated because CREATE OR REPLACE VIEW replaces the whole body.

CREATE OR REPLACE VIEW analytics_activity AS

  SELECT e."userId" AS user_id, e.ts AS ts, e.surface AS surface, e.name AS kind
    FROM "Event" e
   WHERE e."userId" IS NOT NULL
     AND e.name IN ('view', 'open', 'progress', 'finish', 'blocked', 'login', 'error')

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

  UNION ALL SELECT s."createdById", s."createdAt", 'group',   'start'    FROM "ShareLink"       s
  UNION ALL SELECT u."userId",      u."createdAt", 'group',   'finish'   FROM "ShareLinkUse"    u
  UNION ALL SELECT l."hostId",      l."createdAt", 'live',    'start'    FROM "LiveSession"     l
  UNION ALL SELECT p."userId",      p."joinedAt",  'live',    'finish'   FROM "LiveParticipant" p
  UNION ALL SELECT m."userId",      m."createdAt", 'support', 'finish'   FROM "SupportMessage"  m WHERE m."fromAdmin" = false

  UNION ALL SELECT p."userId",      p."createdAt", 'upgrade', 'checkout' FROM "Payment"         p

  -- paid = when the money was actually confirmed: paidAt for a provider webhook,
  -- reviewedAt for a manual admin approval. COALESCE order matters — a refunded-then-
  -- re-reviewed row should still date from the original confirmation.
  UNION ALL SELECT p."userId", COALESCE(p."paidAt", p."reviewedAt"), 'upgrade', 'paid'
    FROM "Payment" p
   WHERE p.status = 'APPROVED' AND COALESCE(p."paidAt", p."reviewedAt") IS NOT NULL

  UNION ALL SELECT u.id,            u."createdAt", 'auth',    'signup'   FROM "User"            u;
