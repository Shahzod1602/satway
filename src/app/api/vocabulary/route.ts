import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { parseJson } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { nextReview } from "@/lib/srs";
import { VOCAB_DECKS } from "@/lib/vocabulary";

export const dynamic = "force-dynamic";

/** Every valid word id, so a client cannot invent rows. */
const WORD_IDS: ReadonlySet<string> = new Set(
  VOCAB_DECKS.flatMap((d) => d.words.map((w) => w.id)),
);

const reviewSchema = z.object({
  wordId: z.string().min(1).max(60),
  correct: z.boolean(),
});

const migrateSchema = z.object({
  /** One-time import of the old localStorage "known" set. */
  knownWordIds: z.array(z.string().max(60)).max(500),
});

/** This student's whole vocabulary memory. */
export const GET = withErrorHandling(async () => {
  const user = await currentUser();
  if (!user) return jsonError("Authorization required", 401);

  const rows = await prisma.vocabProgress.findMany({
    where: { userId: user.id },
    select: { wordId: true, box: true, dueAt: true, correctCount: true, wrongCount: true },
  });

  return Response.json({ progress: rows });
});

/** Record one answer. */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await currentUser();
  if (!user) return jsonError("Authorization required", 401);

  // A quiz answer is one cheap upsert, but this endpoint is a write loop driven by a
  // client — bound it so a stuck retry cannot hammer the DB.
  const rl = rateLimit(`vocab:${user.id}`, 300, 10 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { wordId, correct } = await parseJson(req, reviewSchema);
  // The deck is static data in the repo; anything not in it is a client bug or a probe.
  if (!WORD_IDS.has(wordId)) return jsonError("Unknown word", 400);

  const prev = await prisma.vocabProgress.findUnique({
    where: { userId_wordId: { userId: user.id, wordId } },
    select: { box: true, correctCount: true, wrongCount: true },
  });

  const next = nextReview(prev, correct);

  const saved = await prisma.vocabProgress.upsert({
    where: { userId_wordId: { userId: user.id, wordId } },
    create: { userId: user.id, wordId, ...next },
    update: next,
    select: { wordId: true, box: true, dueAt: true, correctCount: true, wrongCount: true },
  });

  return Response.json({ ok: true, progress: saved });
});

/**
 * Import a browser's old localStorage progress, once.
 *
 * Without this, every student who has been using the flashcards loses everything the day
 * this ships — which is a worse experience than never having stored it. A previously
 * "known" word starts at box 3 (learned, next review in a week): it claims neither that
 * they have drilled it five times nor that they have never seen it.
 */
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const user = await currentUser();
  if (!user) return jsonError("Authorization required", 401);

  const { knownWordIds } = await parseJson(req, migrateSchema);
  const valid = knownWordIds.filter((id) => WORD_IDS.has(id));
  if (valid.length === 0) return Response.json({ ok: true, imported: 0 });

  const now = new Date();
  const dueAt = new Date(now.getTime() + 7 * 86_400_000);

  // skipDuplicates: a student who has already reviewed a word ON THIS DEVICE has better
  // data than the imported flag — the import must never overwrite a real review.
  const res = await prisma.vocabProgress.createMany({
    data: valid.map((wordId) => ({
      userId: user.id,
      wordId,
      box: 3,
      dueAt,
      correctCount: 1,
      lastReviewedAt: now,
    })),
    skipDuplicates: true,
  });

  return Response.json({ ok: true, imported: res.count });
});
