import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";
import { effectivePlan, isPremiumActive } from "@/lib/access";
import { computeStreak } from "@/lib/streak";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const tabRaw = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab;
  const initialTab = (tabRaw ?? "").toUpperCase();

  const [tests, dbUser, attemptDays] = await Promise.all([
    prisma.test.findMany({
      where: { published: true },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { sections: true } } },
    }),
    prisma.user.findUnique({ where: { id: user.id }, select: { plan: true, premiumUntil: true } }),
    prisma.testAttempt.findMany({
      where: { userId: user.id, status: "SUBMITTED" },
      select: { submittedAt: true },
      orderBy: { submittedAt: "desc" },
      take: 400,
    }),
  ]);

  // Current daily-practice streak on the Asia/Tashkent calendar (see lib/streak).
  const streak = computeStreak(attemptDays.map((a) => a.submittedAt));

  // Premium that lapsed (incl. an ended trial) → show the win-back banner.
  const premiumExpired =
    dbUser?.plan === "PREMIUM" &&
    !!dbUser?.premiumUntil &&
    !isPremiumActive(dbUser.plan, dbUser.premiumUntil);

  return (
    <DashboardClient
      user={JSON.parse(JSON.stringify(user))}
      tests={JSON.parse(JSON.stringify(tests))}
      plan={effectivePlan(dbUser?.plan, dbUser?.premiumUntil)}
      premiumExpired={premiumExpired}
      initialTab={initialTab}
      streak={streak}
    />
  );
}
