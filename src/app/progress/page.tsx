import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ProgressClient from "./ProgressClient";
import { effectivePlan } from "@/lib/access";
import { topicOf } from "@/lib/topics";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [attempts, answers, dbUser] = await Promise.all([
    prisma.testAttempt.findMany({
      where: { userId: user.id, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      include: { test: { select: { title: true, skill: true } } },
      take: 50,
    }),
    prisma.attemptAnswer.findMany({
      where: { attempt: { userId: user.id, status: "SUBMITTED" } },
      select: { isCorrect: true, question: { select: { type: true } } },
      take: 5000,
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, premiumUntil: true, targetScore: true, examDate: true },
    }),
  ]);

  // Aggregate correctness by topic (weakest first).
  const acc = new Map<string, { correct: number; total: number }>();
  for (const a of answers) {
    const topic = topicOf(a.question.type);
    const cur = acc.get(topic) ?? { correct: 0, total: 0 };
    cur.total += 1;
    if (a.isCorrect) cur.correct += 1;
    acc.set(topic, cur);
  }
  const topics = Array.from(acc.entries())
    .map(([topic, v]) => ({ topic, correct: v.correct, total: v.total, pct: Math.round((v.correct / v.total) * 100) }))
    .filter((t) => t.total >= 2)
    .sort((a, b) => a.pct - b.pct);

  return (
    <ProgressClient
      user={JSON.parse(JSON.stringify(user))}
      attempts={JSON.parse(JSON.stringify(attempts))}
      topics={topics}
      goals={{
        targetScore: dbUser?.targetScore ?? null,
        examDate: dbUser?.examDate?.toISOString() ?? null,
      }}
      plan={effectivePlan(dbUser?.plan, dbUser?.premiumUntil)}
    />
  );
}
