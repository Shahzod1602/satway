-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "itemId" TEXT,
    "userId" TEXT,
    "plan" TEXT NOT NULL DEFAULT '',
    "origin" TEXT NOT NULL DEFAULT 'USER',
    "ms" INTEGER,
    "pct" INTEGER,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "model" TEXT,
    "inTextTok" INTEGER,
    "inAudioTok" INTEGER,
    "inCachedTok" INTEGER,
    "outTextTok" INTEGER,
    "outAudioTok" INTEGER,
    "thinkTok" INTEGER,
    "images" INTEGER,
    "usdMicros" INTEGER,
    "priceRev" TEXT,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "estimated" BOOLEAN NOT NULL DEFAULT false,
    "retries" INTEGER,
    "attemptId" TEXT,
    "props" JSONB,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiBillMonth" (
    "month" TEXT NOT NULL,
    "actualUsdCents" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiBillMonth_pkey" PRIMARY KEY ("month")
);

-- CreateTable
CREATE TABLE "AiAlert" (
    "id" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_ts_idx" ON "Event"("ts");

-- CreateIndex
CREATE INDEX "Event_name_ts_idx" ON "Event"("name", "ts");

-- CreateIndex
CREATE INDEX "Event_surface_ts_idx" ON "Event"("surface", "ts");

-- CreateIndex
CREATE INDEX "Event_userId_ts_idx" ON "Event"("userId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "AiAlert_day_kind_target_key" ON "AiAlert"("day", "kind", "target");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
