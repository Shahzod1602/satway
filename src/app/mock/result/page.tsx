import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Trophy } from "lucide-react";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";

export const dynamic = "force-dynamic";

// Full-mock score report (Reading & Writing + Math → 400–1600). Both sections are
// their own TestAttempt; this page pairs them by the ?rw= / ?math= ids the mock
// flow passes, so the combined score is a real, shareable report — not a window.alert.
export default async function MockResultPage({
  searchParams,
}: {
  searchParams: Promise<{ rw?: string; math?: string }>;
}) {
  const { rw, math } = await searchParams;
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!rw || !math) notFound();

  const [rwAttempt, mathAttempt] = await Promise.all([
    prisma.testAttempt.findFirst({
      where: { id: rw, userId: user.id },
      select: { id: true, scaledScore: true, rawScore: true, totalQuestions: true, test: { select: { skill: true, title: true } } },
    }),
    prisma.testAttempt.findFirst({
      where: { id: math, userId: user.id },
      select: { id: true, scaledScore: true, rawScore: true, totalQuestions: true, test: { select: { skill: true, title: true } } },
    }),
  ]);
  if (!rwAttempt || !mathAttempt) notFound();

  const rwScore = rwAttempt.scaledScore ?? 0;
  const mathScore = mathAttempt.scaledScore ?? 0;
  const total = rwScore + mathScore;

  return (
    <div className="min-h-screen">
      <AppHeader name={user.name} role={user.role} />

      <main className="mx-auto max-w-3xl px-5 py-8">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>

        {/* Combined 1600 score */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-600">
            <Trophy className="h-3.5 w-3.5" /> Full mock complete
          </span>
          <p className="mt-4 text-6xl font-extrabold leading-none text-brand-600">{total}</p>
          <p className="mt-2 text-sm text-slate-500">out of 1600</p>
        </div>

        {/* Section breakdown */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SectionCard
            label="Reading & Writing"
            score={rwAttempt.scaledScore}
            raw={rwAttempt.rawScore}
            total={rwAttempt.totalQuestions}
            href={`/results/${rwAttempt.id}`}
          />
          <SectionCard
            label="Math"
            score={mathAttempt.scaledScore}
            raw={mathAttempt.rawScore}
            total={mathAttempt.totalQuestions}
            href={`/results/${mathAttempt.id}`}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/progress" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
            View progress <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/mock" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Take another mock
          </Link>
        </div>
      </main>
    </div>
  );
}

function SectionCard({
  label, score, raw, total, href,
}: {
  label: string;
  score: number | null;
  raw: number | null;
  total: number | null;
  href: string;
}) {
  return (
    <Link href={href} className="group rounded-2xl border border-slate-200 bg-white p-5 transition-colors hover:border-brand-300">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-extrabold text-slate-900">{score ?? "—"}<span className="text-lg font-semibold text-slate-400"> /800</span></p>
      <p className="mt-1 text-sm text-slate-500">{raw ?? 0}/{total ?? 0} correct</p>
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:gap-1.5">
        Review answers <ArrowRight className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}
