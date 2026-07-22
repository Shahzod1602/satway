-- CreateEnum
CREATE TYPE "TestLevel" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- AlterTable: whole-test difficulty band (existing rows default to MEDIUM)
ALTER TABLE "Test" ADD COLUMN "level" "TestLevel" NOT NULL DEFAULT 'MEDIUM';

-- AlterTable: student's self-selected practice level (nullable = not chosen yet)
ALTER TABLE "User" ADD COLUMN "level" "TestLevel";
