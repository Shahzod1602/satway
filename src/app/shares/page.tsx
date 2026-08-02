import Link from "next/link";
import { redirect } from "next/navigation";
import { Share2 } from "lucide-react";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { effectivePlan } from "@/lib/access";
import Sidebar from "@/components/Sidebar";
import SharesClient, { type ShareLinkData } from "./SharesClient";

export const dynamic = "force-dynamic";

function firstNameInitial(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  if (p.length <= 1) return p[0] || "Student";
  return `${p[0]} ${p[p.length - 1][0].toUpperCase()}.`;
}

export default async function SharesPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: { plan: true, premiumUntil: true },
  });
  const isPremium = effectivePlan(dbUser?.plan, dbUser?.premiumUntil) === "PREMIUM";

  if (!isPremium) {
    return (
      <div className="flex min-h-screen bg-[var(--background)]">
        <Sidebar name={user.name} role={user.role} plan="FREE" />
        <div className="min-w-0 flex-1">
          <main className="px-6 pt-6 pb-10">
            <h1 className="text-2xl font-bold text-slate-900">Share tests</h1>
            <div className="mt-8 rounded-2xl border border-dashed border-[var(--border)] bg-white p-12 text-center">
              <Share2 className="mx-auto h-10 w-10 text-brand-400" />
              <p className="mt-3 text-sm text-slate-600">
                Sharing is a Premium feature. Go Premium to invite friends to a test (up to 3 each) or
                run a whole class with an unlimited link.
              </p>
              <Link href="/upgrade" className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                See Premium
              </Link>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const [tests, links] = await Promise.all([
    prisma.test.findMany({
      where: { published: true },
      select: { id: true, title: true, skill: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.shareLink.findMany({
      where: { createdById: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        test: { select: { title: true, slug: true } },
        uses: { orderBy: { createdAt: "asc" }, include: { user: { select: { id: true, name: true } } } },
      },
    }),
  ]);

  // Bulk-load the redeemers' scores on the shared tests for the results panel.
  const redeemerIds = [...new Set(links.flatMap((l) => l.uses.map((u) => u.userId)))];
  const testIds = [...new Set(links.map((l) => l.testId))];
  const attempts = redeemerIds.length
    ? await prisma.testAttempt.findMany({
        where: { status: "SUBMITTED", userId: { in: redeemerIds }, testId: { in: testIds } },
        select: { userId: true, testId: true, scaledScore: true, rawScore: true, totalQuestions: true },
      })
    : [];
  const best = new Map<string, { score: number | null; raw: number | null; total: number | null }>();
  for (const a of attempts) {
    const key = `${a.userId}|${a.testId}`;
    const prev = best.get(key);
    const score = a.scaledScore ?? null;
    if (!prev || (score ?? -1) > (prev.score ?? -1)) {
      best.set(key, { score, raw: a.rawScore, total: a.totalQuestions });
    }
  }

  const data: ShareLinkData[] = links.map((l) => ({
    id: l.id,
    token: l.token,
    kind: l.kind,
    active: l.active,
    maxUses: l.maxUses,
    test: { title: l.test.title, slug: l.test.slug },
    count: l.uses.length,
    redeemers: l.uses.map((u) => {
      const b = best.get(`${u.userId}|${l.testId}`);
      return {
        name: firstNameInitial(u.user.name),
        score: b?.score ?? null,
        raw: b?.raw ?? null,
        total: b?.total ?? null,
      };
    }),
  }));

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      <Sidebar name={user.name} role={user.role} plan="PREMIUM" />
      <div className="min-w-0 flex-1">
        <SharesClient tests={tests} initialLinks={data} />
      </div>
    </div>
  );
}
