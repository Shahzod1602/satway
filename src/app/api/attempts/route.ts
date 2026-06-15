import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { gradeAnswer, type SatQuestionType } from "@/lib/grading";
import { rawToScaled, type SatSkill } from "@/lib/scoring";
import { canAccessTest, effectivePlan } from "@/lib/access";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "Authorization required" }, { status: 401 });
  }

  let body: { testId?: unknown; answers?: unknown; module?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const testId = body.testId;
  const answers = (body.answers ?? {}) as Record<string, string | string[]>;
  if (typeof testId !== "string" || !testId) {
    return NextResponse.json({ error: "testId is required" }, { status: 400 });
  }
  if (typeof body.answers !== "object" || body.answers === null) {
    return NextResponse.json({ error: "answers must be an object" }, { status: 400 });
  }

  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { sections: { include: { questions: true } } },
  });
  if (!test) {
    return NextResponse.json({ error: "Test not found" }, { status: 404 });
  }
  if (!test.published) {
    return NextResponse.json({ error: "Test not available" }, { status: 403 });
  }

  // Freemium gate
  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, premiumUntil: true },
  });
  if (!canAccessTest(effectivePlan(dbUser?.plan, dbUser?.premiumUntil), test.slug)) {
    return NextResponse.json({ error: "This test requires Premium." }, { status: 403 });
  }

  const sortedSections = test.sections.slice().sort((a, b) => a.order - b.order);

  // Optional single-module submission
  let moduleNum: number | null = null;
  if (typeof body.module === "number" && Number.isInteger(body.module)) {
    if (body.module < 1 || body.module > sortedSections.length) {
      return NextResponse.json({ error: "Invalid module" }, { status: 400 });
    }
    moduleNum = body.module;
  }

  const questions =
    moduleNum != null
      ? sortedSections[moduleNum - 1].questions
      : sortedSections.flatMap((s) => s.questions);

  // Grade
  let rawScore = 0;
  const answerRows = questions.map((q) => {
    const response = answers?.[q.id];
    const isCorrect = gradeAnswer(
      q.type as SatQuestionType,
      (q.correctAnswers as unknown[]) ?? [],
      response,
    );
    if (isCorrect) rawScore += 1;
    return {
      questionId: q.id,
      response: (response ?? "") as Prisma.InputJsonValue,
      isCorrect,
    };
  });

  const total = questions.length;
  // Scaled score only for a full test
  const scaledScore =
    moduleNum != null
      ? null
      : rawToScaled(rawScore, test.skill as SatSkill, total);

  const attempt = await prisma.testAttempt.create({
    data: {
      userId: user.id,
      testId: test.id,
      status: "SUBMITTED",
      submittedAt: new Date(),
      rawScore,
      totalQuestions: total,
      scaledScore,
      module: moduleNum,
      answers: {
        create: answerRows.map((r) => ({
          questionId: r.questionId,
          response: r.response,
          isCorrect: r.isCorrect,
        })),
      },
    },
  });

  return NextResponse.json({ attemptId: attempt.id, scaledScore, rawScore, total, module: moduleNum });
}
