-- Polar (polar.sh) card checkout — international Visa/Mastercard in USD.
--
-- "amountUsd" is what the card is actually charged (discounted plan + card fee), in US
-- cents; the webhook enforces the paid order's net_amount against it. "amount" keeps
-- carrying the UZS equivalent so revenue queries and promo commission stay in one
-- currency across every provider.
ALTER TABLE "Payment" ADD COLUMN "amountUsd" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "polarCheckoutId" TEXT;
