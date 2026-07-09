-- Subscription gate: users unlock the app by following on Instagram (honor
-- system) and joining the Telegram channel (verified via Bot API getChatMember).
ALTER TABLE "User" ADD COLUMN "igFollowedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "tgSubVerifiedAt" TIMESTAMP(3);
