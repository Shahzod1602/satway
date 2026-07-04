-- CreateEnum
CREATE TYPE "QuestionDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "difficulty" "QuestionDifficulty";

-- AlterTable
ALTER TABLE "AttemptAnswer" ADD COLUMN "timeSpent" INTEGER;
