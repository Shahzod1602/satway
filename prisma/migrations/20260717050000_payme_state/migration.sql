-- Payme Merchant API state machine on Payment (see src/lib/payme.ts).
-- paymeTransId is UNIQUE: every Payme method addresses the row by Payme's own
-- transaction id, and uniqueness is what makes CreateTransaction retries idempotent.

ALTER TABLE "Payment"
  ADD COLUMN "paymeTransId" TEXT,
  ADD COLUMN "paymeState" INTEGER,
  ADD COLUMN "paymeCreatedAt" TIMESTAMP(3),
  ADD COLUMN "paymeCancelledAt" TIMESTAMP(3),
  ADD COLUMN "paymeCancelReason" INTEGER;

CREATE UNIQUE INDEX "Payment_paymeTransId_key" ON "Payment"("paymeTransId");
