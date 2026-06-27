-- Server-side module timing + leaderboard integrity flag
ALTER TABLE "TestAttempt" ADD COLUMN "moduleStartedAt" TIMESTAMP(3);
ALTER TABLE "TestAttempt" ADD COLUMN "flagged" BOOLEAN NOT NULL DEFAULT false;
