import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ProgressClient from "./ProgressClient";
import { effectivePlan } from "@/lib/access";

export const dynamic = "force-dynamic";

// Group fine-grained question types into the topics shown to students.
const TOPIC: Record<string, string> = {
  ALGEBRA: "Algebra",
  ADVANCED_MATH: "Advanced Math",
  PROBLEM_SOLVING: "Problem Solving & Data",
  DATA_ANALYSIS: "Problem Solving & Data",
  GEOMETRY: "Geometry & Trig",
  STUDENT_PRODUCED_RESPONSE: "Math grid-ins",
  WORDS_IN_CONTEXT: "Words in Context",
  TRANSITIONS: "Transitions",
  BOUNDARIES: "Grammar & Boundaries",
  RHETORICAL_SYNTHESIS: "Rhetorical Synthesis",
  CENTRAL_IDEAS: "Central Ideas",
  INFERENCE: "Inference",
  TEXTUAL_EVIDENCE: "Command of Evidence",
  CROSS_TEXT_CONNECTIONS: "Command of Evidence",
  PARAGRAPH_REFERENCE: "Reading Comprehension",
  TEXT_STRUCTURE: "Text Structure",
  FORM_STRUCTURE: "Text Structure",
  MCQ_SINGLE: "General",
};

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
    const topic = TOPIC[a.question.type] ?? "Other";
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
