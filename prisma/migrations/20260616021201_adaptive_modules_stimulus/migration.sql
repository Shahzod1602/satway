-- CreateEnum
CREATE TYPE "SectionDifficulty" AS ENUM ('STANDARD', 'EASY', 'HARD');

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "stimulus" TEXT;

-- AlterTable
ALTER TABLE "Section" ADD COLUMN     "difficulty" "SectionDifficulty" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "module" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "TestAttempt" ADD COLUMN     "module1Raw" INTEGER,
ADD COLUMN     "module2Difficulty" "SectionDifficulty";

-- CreateIndex
CREATE INDEX "Section_testId_module_difficulty_idx" ON "Section"("testId", "module", "difficulty");
