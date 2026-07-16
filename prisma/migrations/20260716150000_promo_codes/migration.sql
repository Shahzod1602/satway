-- Promo codes, and the columns that let a Payment remember what it was sold under.
--
-- Hand-written rather than generated, because two details need to be deliberate:
--   1. orderNo is SERIAL, which numbers the EXISTING payments on the way in rather than
--      leaving the whole back catalogue without a reference an admin can search for.
--   2. baseAmount is backfilled from `amount` — before promo codes existed, every payment
--      was made at list price, so that is the historically correct value. Leaving it 0
--      would make every past sale look 100% discounted on the promo board.

-- ── Payment: order reference + provider seam ────────────────────────────────
-- SERIAL implies NOT NULL DEFAULT nextval(...) and backfills existing rows.
ALTER TABLE "Payment" ADD COLUMN "orderNo" SERIAL;
CREATE UNIQUE INDEX "Payment_orderNo_key" ON "Payment"("orderNo");

ALTER TABLE "Payment" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'manual';

-- ── Payment: promo snapshot ────────────────────────────────────────────────
ALTER TABLE "Payment" ADD COLUMN "promoCode" TEXT,
  ADD COLUMN "promoOwnerId" TEXT,
  ADD COLUMN "discountPercent" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "commissionPct" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "baseAmount" INTEGER NOT NULL DEFAULT 0;

-- Every payment that already exists was made at list price, before discounts were a
-- thing. Without this, /admin/promo would read a 0 base against a real amount and report
-- nonsense for the entire history.
UPDATE "Payment" SET "baseAmount" = "amount" WHERE "baseAmount" = 0;

CREATE INDEX "Payment_promoOwnerId_idx" ON "Payment"("promoOwnerId");

-- SetNull, not Cascade: deleting the account of a teacher who sold subscriptions must
-- orphan the attribution, never delete the sale.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_promoOwnerId_fkey"
  FOREIGN KEY ("promoOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── PromoCode ──────────────────────────────────────────────────────────────
CREATE TABLE "PromoCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "percentOff" INTEGER NOT NULL,
    "ownerId" TEXT,
    "commissionPct" INTEGER NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");
CREATE INDEX "PromoCode_ownerId_idx" ON "PromoCode"("ownerId");

ALTER TABLE "PromoCode" ADD CONSTRAINT "PromoCode_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
