-- Explicit access gate on Test (replaces slug-string parsing).
ALTER TABLE "Test" ADD COLUMN "isPremium" BOOLEAN NOT NULL DEFAULT true;

-- Backfill to preserve the previous free-tier rule (free = no "test-N" token, or test-1).
UPDATE "Test" SET "isPremium" = false
  WHERE slug !~ 'test-?[0-9]+'
     OR slug ~ 'test-?1($|[^0-9])';
