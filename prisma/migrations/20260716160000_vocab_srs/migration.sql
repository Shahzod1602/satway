-- Vocabulary progress moves from the browser's localStorage into the database.
--
-- No backfill is possible here: the old progress lives in each student's localStorage,
-- which the server has never seen. PUT /api/vocabulary imports it on their next visit —
-- see the client's one-time migration.

CREATE TABLE "VocabProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wordId" TEXT NOT NULL,
    "box" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "wrongCount" INTEGER NOT NULL DEFAULT 0,
    "lastReviewedAt" TIMESTAMP(3),

    CONSTRAINT "VocabProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VocabProgress_userId_wordId_key" ON "VocabProgress"("userId", "wordId");
-- The only hot query: "what is due for this student right now".
CREATE INDEX "VocabProgress_userId_dueAt_idx" ON "VocabProgress"("userId", "dueAt");

ALTER TABLE "VocabProgress" ADD CONSTRAINT "VocabProgress_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
