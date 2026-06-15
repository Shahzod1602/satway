import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import ProgressClient from "./ProgressClient";
import { effectivePlan } from "@/lib/access";

export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [attempts, dbUser] = await Promise.all([
    prisma.testAttempt.findMany({
      where: { userId: user.id, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      include: { test: { select: { title: true, skill: true } } },
      take: 50,
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, premiumUntil: true, targetScore: true, examDate: true },
    }),
  ]);

  return (
    <ProgressClient
      user={JSON.parse(JSON.stringify(user))}
      attempts={JSON.parse(JSON.stringify(attempts))}
      goals={{
        targetScore: dbUser?.targetScore ?? null,
        examDate: dbUser?.examDate?.toISOString() ?? null,
      }}
      plan={effectivePlan(dbUser?.plan, dbUser?.premiumUntil)}
    />
  );
}
