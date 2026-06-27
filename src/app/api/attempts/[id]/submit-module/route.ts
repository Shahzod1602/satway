import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { gradeAnswer, type SatQuestionType } from "@/lib/grading";
import { rawToScaled, rawToScaledAdaptive, pickModule2Difficulty, type SatSkill } from "@/lib/scoring";
import { buildClientModule, findModule1, findModule2, hasModule2, moduleDurationSec } from "@/lib/exam";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";
import type { Prisma } from "@/generated/prisma/client";

const bodySchema = z.object({
  answers: z.record(
    z.string(),
    z.union([z.string(), z.array(z.string())]),
  ),
});

type GradedQuestion = {
  id: string;
  type: string;
  correctAnswers: unknown;
};

/** Grade a set of questions against the submitted answers (server-authoritative). */
function gradeSection(
  questions: GradedQuestion[],
  answers: Record<string, string | string[]>,
) {
  let raw = 0;
  const rows = questions.map((q) => {
    const response = answers[q.id];
    const isCorrect = gradeAnswer(
      q.type as SatQuestionType,
      Array.isArray(q.correctAnswers) ? q.correctAnswers : [q.correctAnswers],
      response,
    );
    if (isCorrect) raw += 1;
    return {
      questionId: q.id,
      response: (response ?? "") as Prisma.InputJsonValue,
      isCorrect,
    };
  });
  return { raw, total: questions.length, rows };
}

// Submit the current module of an attempt. Stateful: the server infers whether
// this is Module 1 or Module 2 from the attempt's stored progress, grades it,
// and either returns the adaptive Module 2 or the final score.
export const POST = withErrorHandling(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const user = await currentUser();
    if (!user) return jsonError("Authorization required", 401);

    const { id } = await ctx.params;
    const { answers } = await parseJson(req, bodySchema);
    if (Object.keys(answers).length > 200) return jsonError("Too many answers", 400);

    const attempt = await prisma.testAttempt.findFirst({
      where: { id, userId: user.id },
    });
    if (!attempt) return jsonError("Attempt not found", 404);
    if (attempt.status !== "IN_PROGRESS") {
      return jsonError("This attempt has already been submitted", 409);
    }

    const test = await prisma.test.findUnique({
      where: { id: attempt.testId },
      include: { sections: { include: { questions: true } } },
    });
    if (!test) return jsonError("Test not found", 404);
    const skill = test.skill as SatSkill;

    // Server-side time-limit guard. The client auto-submits at 0, so honest users
    // are always within the limit; a tampered/paused client clock that submits
    // long after the deadline gets flagged (not rejected — we keep the result)
    // and flagged attempts are excluded from the leaderboard.
    const GRACE_SEC = 180;
    const moduleExceeded =
      !!attempt.moduleStartedAt &&
      (Date.now() - attempt.moduleStartedAt.getTime()) / 1000 > moduleDurationSec(skill) + GRACE_SEC;

    // ── Single-module practice ──────────────────────────────────────────
    if (attempt.module != null) {
      const section =
        attempt.module === 1
          ? findModule1(test.sections)
          : findModule2(test.sections, (attempt.module2Difficulty as "EASY" | "HARD") ?? "HARD");
      if (!section) return jsonError("Module not found", 400);

      const { raw, total, rows } = gradeSection(section.questions, answers);
      await prisma.$transaction([
        prisma.attemptAnswer.createMany({
          data: rows.map((r) => ({ attemptId: attempt.id, ...r })),
          skipDuplicates: true,
        }),
        // Guard on status so two concurrent submits can't both score the attempt.
        prisma.testAttempt.updateMany({
          where: { id: attempt.id, status: "IN_PROGRESS" },
          data: {
            status: "SUBMITTED",
            submittedAt: new Date(),
            rawScore: raw,
            totalQuestions: total,
            scaledScore: null, // module-only practice has no scaled score
            flagged: moduleExceeded,
          },
        }),
      ]);
      return Response.json({
        stage: "done",
        attemptId: attempt.id,
        scaledScore: null,
        rawScore: raw,
        total,
      });
    }

    // ── Full adaptive test ──────────────────────────────────────────────

    // Module 1 submission (module1Raw not yet recorded).
    if (attempt.module1Raw == null) {
      const m1 = findModule1(test.sections);
      if (!m1) return jsonError("Module 1 not found", 400);

      const { raw, total, rows } = gradeSection(m1.questions, answers);

      // No Module 2 configured → finish as a single-section test.
      if (!hasModule2(test.sections)) {
        const scaled = rawToScaled(raw, skill, total);
        await prisma.$transaction([
          prisma.attemptAnswer.createMany({
            data: rows.map((r) => ({ attemptId: attempt.id, ...r })),
            skipDuplicates: true,
          }),
          prisma.testAttempt.updateMany({
            where: { id: attempt.id, status: "IN_PROGRESS" },
            data: {
              status: "SUBMITTED",
              submittedAt: new Date(),
              rawScore: raw,
              totalQuestions: total,
              scaledScore: scaled,
              module1Raw: raw,
              flagged: moduleExceeded,
            },
          }),
        ]);
        return Response.json({
          stage: "done",
          attemptId: attempt.id,
          scaledScore: scaled,
          rawScore: raw,
          total,
        });
      }

      const difficulty = pickModule2Difficulty(raw, total);
      const m2 = findModule2(test.sections, difficulty);
      if (!m2) return jsonError("Module 2 not found", 400);
      // Store the difficulty of the section ACTUALLY served (the fallback may
      // serve the other variant), so final scoring caps/floors match the questions.
      const servedDifficulty = (m2.difficulty as "EASY" | "HARD") ?? difficulty;

      await prisma.$transaction([
        prisma.attemptAnswer.createMany({
          data: rows.map((r) => ({ attemptId: attempt.id, ...r })),
          skipDuplicates: true,
        }),
        // Guard on module1Raw=null so a duplicate Module-1 submit can't re-route.
        prisma.testAttempt.updateMany({
          where: { id: attempt.id, status: "IN_PROGRESS", module1Raw: null },
          data: {
            module1Raw: raw,
            module2Difficulty: servedDifficulty,
            moduleStartedAt: new Date(), // reset the clock for Module 2
            flagged: moduleExceeded,
          },
        }),
      ]);

      return Response.json({
        stage: "module2",
        module: buildClientModule(m2, skill),
      });
    }

    // Module 2 submission (final).
    const difficulty = (attempt.module2Difficulty as "EASY" | "HARD") ?? "EASY";
    const m1 = findModule1(test.sections);
    const m2 = findModule2(test.sections, difficulty);
    if (!m1 || !m2) return jsonError("Modules not found", 400);

    const { raw: m2Raw, rows } = gradeSection(m2.questions, answers);
    const totalRaw = attempt.module1Raw + m2Raw;
    const total = m1.questions.length + m2.questions.length;
    const scaled = rawToScaledAdaptive(totalRaw, skill, total, difficulty);

    await prisma.$transaction([
      prisma.attemptAnswer.createMany({
        data: rows.map((r) => ({ attemptId: attempt.id, ...r })),
        skipDuplicates: true,
      }),
      prisma.testAttempt.updateMany({
        where: { id: attempt.id, status: "IN_PROGRESS" },
        data: {
          status: "SUBMITTED",
          submittedAt: new Date(),
          rawScore: totalRaw,
          totalQuestions: total,
          scaledScore: scaled,
          flagged: moduleExceeded || attempt.flagged,
        },
      }),
    ]);

    return Response.json({
      stage: "done",
      attemptId: attempt.id,
      scaledScore: scaled,
      rawScore: totalRaw,
      total,
    });
  },
);
