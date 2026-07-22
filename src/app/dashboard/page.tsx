import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import DashboardClient from "./DashboardClient";
import { effectivePlan, isPremiumActive } from "@/lib/access";
import { effectiveStreak } from "@/lib/streak";
import { suggestLevel } from "@/lib/level";

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

  const [tests, dbUser, scoredAttempts] = await Promise.all([
    prisma.test.findMany({
      where: { published: true },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { sections: true } } },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        plan: true,
        premiumUntil: true,
        currentStreak: true,
        lastActiveDay: true,
        level: true,
        targetScore: true,
        targetRWScore: true,
        targetMathScore: true,
      },
    }),
    // Only the two numbers the level suggestion needs — best RW, best Math.
    prisma.testAttempt.findMany({
      where: { userId: user.id, scaledScore: { not: null } },
      select: { scaledScore: true, test: { select: { skill: true } } },
    }),
  ]);

  // Seed the level picker from performance first (best total, 400–1600), then target.
  const bestFor = (skill: string) => {
    const v = scoredAttempts
      .filter((a) => a.test.skill === skill && a.scaledScore != null)
      .map((a) => a.scaledScore as number);
    return v.length ? Math.max(...v) : null;
  };
  const bestRW = bestFor("READING_WRITING");
  const bestMath = bestFor("MATH");
  const bestTotal =
    bestRW != null && bestMath != null
      ? bestRW + bestMath
      : bestRW != null
        ? bestRW * 2
        : bestMath != null
          ? bestMath * 2
          : null;
  const targetTotal =
    dbUser?.targetScore ??
    (dbUser?.targetRWScore != null && dbUser?.targetMathScore != null
      ? dbUser.targetRWScore + dbUser.targetMathScore
      : null);
  const suggestedLevel = suggestLevel({ bestTotal, targetTotal });

  // Read the stored streak rather than re-deriving it from 400 attempt rows on every
  // dashboard load. effectiveStreak() decays it once the student goes idle (lib/streak).
  const streak = effectiveStreak(dbUser?.currentStreak, dbUser?.lastActiveDay);

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
      userLevel={dbUser?.level ?? null}
      suggestedLevel={suggestedLevel}
    />
  );
}
