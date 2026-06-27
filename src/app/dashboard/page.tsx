import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";
import { effectivePlan } from "@/lib/access";

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

  // Current daily-practice streak (consecutive days ending today or yesterday).
  const dayKeys = new Set(
    attemptDays.map((a) => (a.submittedAt ?? new Date(0)).toISOString().slice(0, 10)),
  );
  let streak = 0;
  const cur = new Date();
  const key = (d: Date) => d.toISOString().slice(0, 10);
  if (!dayKeys.has(key(cur))) cur.setUTCDate(cur.getUTCDate() - 1);
  while (dayKeys.has(key(cur))) {
    streak += 1;
    cur.setUTCDate(cur.getUTCDate() - 1);
  }

  // Premium that lapsed (incl. an ended trial) → show the win-back banner.
  const premiumExpired =
    dbUser?.plan === "PREMIUM" &&
    !!dbUser?.premiumUntil &&
    new Date(dbUser.premiumUntil).getTime() <= Date.now();

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
