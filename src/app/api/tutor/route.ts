import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { parseJson } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { effectivePlan } from "@/lib/access";
import { tutorReply, type TutorTurn } from "@/lib/vertexai";
import { blocked } from "@/lib/events";
import { BLOCK_REASONS } from "@/lib/surfaces";

const bodySchema = z.object({
  questionId: z.string().min(1).max(60),
  attemptId: z.string().min(1).max(60),
  message: z.string().trim().min(1, "Message is empty").max(1000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .max(16)
    .optional(),
});

// Map the stored ISO-ish language code to a name the model responds in.
const LANGUAGE: Record<string, string> = {
  uz: "Uzbek",
  uzbek: "Uzbek",
  ru: "Russian",
  russian: "Russian",
  en: "English",
  english: "English",
};

function formatResponse(resp: unknown): string {
  if (resp == null) return "";
  if (Array.isArray(resp)) return resp.map(String).join(", ");
  return String(resp);
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await currentUser();
  if (!user) return jsonError("Authorization required", 401);

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, premiumUntil: true, nativeLanguage: true },
  });
  const plan = effectivePlan(dbUser?.plan, dbUser?.premiumUntil);
  if (plan !== "PREMIUM") {
    // The demand signal for the one feature we charge for. Without it, a free user
    // who wanted the tutor is indistinguishable from one who never looked.
    blocked("tutor", { userId: user.id, plan, reason: BLOCK_REASONS.PREMIUM_REQUIRED });
    return jsonError("The AI tutor is a Premium feature.", 403);
  }

  // AI calls are costly — cap per user regardless of source IP.
  const rl = rateLimit(`tutor:${user.id}`, 30, 10 * 60 * 1000); // 30 / 10 min
  if (!rl.ok) {
    // A paying user hitting this is a product bug, not abuse — it should be visible.
    blocked("tutor", { userId: user.id, plan, reason: BLOCK_REASONS.RATE_LIMIT });
    return tooManyRequests(rl.retryAfterSec);
  }

  const { questionId, attemptId, message, history } = await parseJson(req, bodySchema);

  // The student may only tutor a question from their OWN submitted attempt, and we
  // read the question + their real answer server-side (never trust client-sent keys).
  const answer = await prisma.attemptAnswer.findFirst({
    where: { questionId, attempt: { id: attemptId, userId: user.id } },
    select: {
      isCorrect: true,
      response: true,
      question: {
        select: { prompt: true, options: true, correctAnswers: true, explanation: true },
      },
    },
  });
  if (!answer) return jsonError("Question not found", 404);

  const q = answer.question;
  const language =
    LANGUAGE[(dbUser?.nativeLanguage ?? "").toLowerCase()] ??
    "the language the student writes in (default English)";

  try {
    const reply = await tutorReply({
      question: {
        prompt: q.prompt ?? "",
        options: (q.options as string[] | null) ?? null,
        correctAnswers: (q.correctAnswers as string[]) ?? [],
        explanation: q.explanation,
      },
      studentAnswer: formatResponse(answer.response),
      wasCorrect: answer.isCorrect,
      language,
      history: (history as TutorTurn[]) ?? [],
      message,
      ctx: { userId: user.id, plan, origin: "USER", attemptId, itemId: questionId },
    });
    return Response.json({ reply });
  } catch (e) {
    console.error("[tutor] AI error:", e);
    return jsonError("The tutor is unavailable right now. Please try again.", 502);
  }
});
