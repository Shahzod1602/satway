import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Flame,
  Crown,
  Sparkles,
  ArrowRight,
  ClipboardList,
  BookText,
  LineChart,
  Target,
  PlayCircle,
} from "lucide-react";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import PremiumExpiredBanner from "@/components/PremiumExpiredBanner";
import { effectivePlan } from "@/lib/access";
import Sidebar from "@/components/Sidebar";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const skillLabel = (s: string) => (s === "MATH" ? "Math" : "Reading & Writing");

function StatCard({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[#EAEAEA] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1.5 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function ActionTile({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-2 rounded-2xl border border-[#EAEAEA] bg-white p-4 transition-colors hover:border-brand-600/40 hover:bg-brand-50/40"
    >
      <Icon className="h-5 w-5 text-brand-600" />
      <span className="text-sm font-semibold text-slate-800">{label}</span>
    </Link>
  );
}

export default async function HomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const [dbUser, submitted, inProgress, tests, totalSolved] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      select: { plan: true, premiumUntil: true },
    }),
    prisma.testAttempt.findMany({
      where: { userId: user.id, status: "SUBMITTED" },
      orderBy: { submittedAt: "desc" },
      include: { test: { select: { title: true, skill: true, slug: true } } },
      take: 100,
    }),
    prisma.testAttempt.findFirst({
      where: { userId: user.id, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
      include: { test: { select: { title: true, skill: true, slug: true } } },
    }),
    prisma.test.findMany({
      where: { published: true },
      orderBy: { createdAt: "asc" },
      select: { slug: true, title: true, skill: true },
    }),
    prisma.testAttempt.count({ where: { userId: user.id, status: "SUBMITTED" } }),
  ]);

  const now = new Date().getTime();
  const plan = effectivePlan(dbUser?.plan, dbUser?.premiumUntil);
  const premiumDaysLeft =
    plan === "PREMIUM" && dbUser?.premiumUntil
      ? Math.max(0, Math.ceil((new Date(dbUser.premiumUntil).getTime() - now) / DAY))
      : null;
  // Premium that lapsed (incl. an ended trial) → show the win-back banner.
  const premiumExpired =
    dbUser?.plan === "PREMIUM" && !!dbUser?.premiumUntil && new Date(dbUser.premiumUntil).getTime() <= now;

  // Streak: consecutive UTC days with a submitted attempt, ending today or yesterday.
  const dayKeys = new Set(
    submitted.map((a) => (a.submittedAt ?? new Date(0)).toISOString().slice(0, 10)),
  );
  const keyOf = (d: Date) => d.toISOString().slice(0, 10);
  let streak = 0;
  const cur = new Date();
  if (!dayKeys.has(keyOf(cur))) cur.setUTCDate(cur.getUTCDate() - 1);
  while (dayKeys.has(keyOf(cur))) {
    streak += 1;
    cur.setUTCDate(cur.getUTCDate() - 1);
  }

  // Scores: scaledScore is 200–800 per section (null for module-only practice).
  const scored = submitted.filter((a) => a.scaledScore != null);
  const avg = scored.length
    ? Math.round(scored.reduce((s, a) => s + (a.scaledScore as number), 0) / scored.length)
    : null;
  const best = scored.length ? Math.max(...scored.map((a) => a.scaledScore as number)) : null;
  const bestBy = (skill: string) => {
    const v = scored.filter((a) => a.test.skill === skill).map((a) => a.scaledScore as number);
    return v.length ? Math.max(...v) : null;
  };
  const bestRW = bestBy("READING_WRITING");
  const bestMath = bestBy("MATH");
  const estTotal = bestRW != null && bestMath != null ? bestRW + bestMath : null;
  const last = submitted[0] ?? null;
  const weekAgo = now - 7 * DAY;
  const thisWeek = submitted.filter(
    (a) => a.submittedAt && new Date(a.submittedAt).getTime() >= weekAgo,
  ).length;

  // Continue: resume an in-progress test, else suggest the next unattempted one.
  const attemptedSlugs = new Set([
    ...submitted.map((a) => a.test.slug),
    ...(inProgress ? [inProgress.test.slug] : []),
  ]);
  const nextTest = tests.find((t) => !attemptedSlugs.has(t.slug)) ?? null;
  const resume = inProgress
    ? { ...inProgress.test, kicker: "Continue practicing", cta: "Resume" }
    : nextTest
      ? { ...nextTest, kicker: "Up next", cta: "Start" }
      : last
        ? { ...last.test, kicker: "Practice again", cta: "Retake" }
        : null;

  const firstName = (user.name ?? "there").trim().split(/\s+/)[0];

  return (
    <div className="flex min-h-screen bg-[#FFFDFB]">
      <Sidebar name={user.name} role={user.role} plan={plan} />
      <div className="min-w-0 flex-1">
        <main className="mx-auto max-w-4xl px-6 pt-6 pb-14">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Welcome back, {firstName} 👋</h1>
              <p className="mt-1 text-sm text-slate-500">
                Let&rsquo;s get a little closer to your target score today.
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-700">
              <Flame className="h-4 w-4 fill-amber-400 text-amber-500" />
              {streak > 0 ? `${streak}-day streak` : "Start your streak"}
            </span>
          </div>

          {/* Premium status */}
          {plan === "PREMIUM" ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-3">
                <Crown className="h-6 w-6 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">Premium is active</p>
                  <p className="text-sm text-emerald-700">
                    {premiumDaysLeft != null
                      ? `${premiumDaysLeft} day${premiumDaysLeft === 1 ? "" : "s"} left`
                      : "All tests unlocked"}
                  </p>
                </div>
              </div>
              <Link
                href="/upgrade"
                className="rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                Manage
              </Link>
            </div>
          ) : premiumExpired ? (
            <PremiumExpiredBanner className="mt-6" />
          ) : (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-600/30 bg-brand-50 p-5">
              <div className="flex items-center gap-3">
                <Sparkles className="h-6 w-6 text-brand-600" />
                <div>
                  <p className="font-semibold text-slate-900">Unlock every test with Premium</p>
                  <p className="text-sm text-slate-600">
                    Test 1 is free — go Premium for all tests and full adaptive mocks.
                  </p>
                </div>
              </div>
              <Link
                href="/upgrade"
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                <Sparkles className="h-4 w-4" /> Get Premium
              </Link>
            </div>
          )}

          {/* Continue / next */}
          {resume && (
            <Link
              href={`/test/${resume.slug}`}
              className="group mt-5 flex items-center gap-4 rounded-2xl border border-brand-600/30 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-600">
                <PlayCircle className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {resume.kicker}
                </p>
                <p className="truncate font-semibold text-slate-900">{resume.title}</p>
                <p className="text-sm text-slate-500">{skillLabel(resume.skill)}</p>
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
                {resume.cta}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </Link>
          )}

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard
              label="Last score"
              value={last?.scaledScore ?? "—"}
              hint={last ? skillLabel(last.test.skill) : "No tests yet"}
            />
            <StatCard
              label="Average"
              value={avg ?? "—"}
              hint={scored.length ? `${scored.length} scored test${scored.length === 1 ? "" : "s"}` : "Out of 800"}
            />
            <StatCard
              label="Best"
              value={best ?? "—"}
              hint={estTotal != null ? `Est. total ${estTotal}` : "Single section"}
            />
            <StatCard label="Completed" value={totalSolved} hint={`${thisWeek} this week`} />
          </div>

          {/* Quick actions */}
          <h2 className="mt-9 text-sm font-semibold text-slate-900">Quick actions</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <ActionTile href="/dashboard" icon={ClipboardList} label="Practice tests" />
            <ActionTile href="/mock" icon={Target} label="Mock exam" />
            <ActionTile href="/vocabulary" icon={BookText} label="Vocabulary" />
            <ActionTile href="/progress" icon={LineChart} label="Your results" />
          </div>
        </main>
      </div>
    </div>
  );
}
