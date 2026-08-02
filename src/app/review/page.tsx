import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { effectivePlan } from "@/lib/access";
import { topicOf } from "@/lib/topics";
import type { SatQuestionType } from "@/lib/grading";
import Sidebar from "@/components/Sidebar";
import ReviewClient, { type ReviewQuestion } from "./ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [answers, dbUser] = await Promise.all([
    // All of the student's graded answers, newest attempt first, so we can keep
    // only the LATEST answer per question and drill the ones still wrong.
    prisma.attemptAnswer.findMany({
      where: {
        attempt: { userId: user.id, status: "SUBMITTED" },
        question: { prompt: { not: null } },
      },
      orderBy: { attempt: { submittedAt: "desc" } },
      select: {
        isCorrect: true,
        attemptId: true,
        question: {
          select: {
            id: true,
            type: true,
            prompt: true,
            options: true,
            correctAnswers: true,
            explanation: true,
            imageUrl: true,
          },
        },
      },
      take: 1500,
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, premiumUntil: true },
    }),
  ]);

  // Keep the most recent answer per question; a question is "missed" only if the
  // latest attempt at it was wrong (so mastered questions drop out of the bank).
  const latest = new Map<string, (typeof answers)[number]>();
  for (const a of answers) if (!latest.has(a.question.id)) latest.set(a.question.id, a);

  const missed: ReviewQuestion[] = [];
  for (const a of latest.values()) {
    if (a.isCorrect) continue;
    missed.push({
      id: a.question.id,
      attemptId: a.attemptId,
      type: a.question.type as SatQuestionType,
      prompt: a.question.prompt,
      options: (a.question.options as string[] | null) ?? null,
      correctAnswers: (a.question.correctAnswers as string[]) ?? [],
      explanation: a.question.explanation,
      imageUrl: a.question.imageUrl,
      topic: topicOf(a.question.type),
    });
  }

  // Weakest topics first (by miss count) for the summary chips.
  const byTopic = new Map<string, number>();
  for (const m of missed) byTopic.set(m.topic, (byTopic.get(m.topic) ?? 0) + 1);
  const topics = [...byTopic.entries()].sort((a, b) => b[1] - a[1]).map(([topic, count]) => ({ topic, count }));

  const isPremium = effectivePlan(dbUser?.plan, dbUser?.premiumUntil) === "PREMIUM";

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar name={user.name} role={user.role} plan={isPremium ? "PREMIUM" : "FREE"} />
      <div className="min-w-0 flex-1">
        <ReviewClient questions={missed} topics={topics} isPremium={isPremium} />
      </div>
    </div>
  );
}
