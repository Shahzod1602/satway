-- CreateEnum
CREATE TYPE "ShareKind" AS ENUM ('FRIEND', 'CLASS');

-- CreateTable
CREATE TABLE "ShareLink" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "testId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "kind" "ShareKind" NOT NULL DEFAULT 'FRIEND',
    "maxUses" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareLinkUse" (
    "id" TEXT NOT NULL,
    "shareLinkId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShareLinkUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShareLink_token_key" ON "ShareLink"("token");
CREATE INDEX "ShareLink_createdById_idx" ON "ShareLink"("createdById");
CREATE INDEX "ShareLink_testId_idx" ON "ShareLink"("testId");
CREATE UNIQUE INDEX "ShareLinkUse_shareLinkId_userId_key" ON "ShareLinkUse"("shareLinkId", "userId");
CREATE INDEX "ShareLinkUse_userId_idx" ON "ShareLinkUse"("userId");

-- AddForeignKey
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_testId_fkey" FOREIGN KEY ("testId") REFERENCES "Test"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareLink" ADD CONSTRAINT "ShareLink_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareLinkUse" ADD CONSTRAINT "ShareLinkUse_shareLinkId_fkey" FOREIGN KEY ("shareLinkId") REFERENCES "ShareLink"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShareLinkUse" ADD CONSTRAINT "ShareLinkUse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
