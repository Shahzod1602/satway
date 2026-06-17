import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { currentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";
import { optionValue } from "@/lib/grading";

export const dynamic = "force-dynamic";

function fmtResponse(resp: unknown, options: string[] | null): string {
  if (resp == null || resp === "") return "—";
  const vals = Array.isArray(resp) ? resp : [resp];
  return vals
    .map((v) => {
      if (options) {
        const match = options.find((o) => optionValue(o) === String(v));
        if (match) return match;
      }
      return String(v);
    })
    .join(", ");
}

function fmtCorrect(correct: unknown, options: string[] | null): string {
  const arr = Array.isArray(correct) ? correct : [correct];
  return arr
    .map((v) => {
      if (options) {
        const match = options.find((o) => optionValue(o) === String(v));
        if (match) return match;
      }
      return String(v);
    })
    .join(" / ");
}

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect("/login");

  const attempt = await prisma.testAttempt.findFirst({
    where: { id, userId: user.id },
    include: {
      test: true,
      answers: {
        include: { question: true },
      },
    },
  });
  if (!attempt) notFound();

  const rows = [...attempt.answers].sort(
    (a, b) => a.question.order - b.question.order,
  );
  const scaledScore = attempt.scaledScore ?? null;
  const pct = attempt.totalQuestions
    ? Math.round(((attempt.rawScore ?? 0) / attempt.totalQuestions) * 100)
    : 0;
  const isModule = attempt.module != null;
  const skillLabel =
    attempt.test.skill === "MATH" ? "Math" : "Reading & Writing";
  const moduleLabel = isModule ? `Module ${attempt.module}` : null;

  return (
    <div className="min-h-screen">
      <AppHeader name={user.name} role={user.role} />

      <main className="mx-auto max-w-4xl px-5 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>

        {/* Score header */}
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
          <div className="grid place-items-center w-32 h-32 rounded-full bg-brand-50 shrink-0 text-center px-2">
            {isModule ? (
              <>
                <span className="text-xs font-medium text-brand-600 uppercase tracking-wide">Score</span>
                <span className="text-4xl font-extrabold text-brand-600 leading-none">
                  {attempt.rawScore}<span className="text-2xl text-brand-400">/{attempt.totalQuestions}</span>
                </span>
              </>
            ) : (
              <span className="text-5xl font-extrabold text-brand-600 leading-none">
                {scaledScore ?? "—"}
              </span>
            )}
          </div>
          <div className="flex-1">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {skillLabel} · {attempt.test.type}
              {isModule ? ` · ${moduleLabel} practice` : ""}
            </span>
            <h1 className="text-xl font-bold text-slate-900">{attempt.test.title}</h1>
            {isModule && (
              <p className="mt-1 text-sm text-slate-500">
                Single-module practice — no scaled score. Only a full test produces a 200–800 score.
              </p>
            )}
            {!isModule && (
              <div className="mt-4 grid grid-cols-2 gap-4 max-w-sm">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Correct answers</p>
                  <p className="text-lg font-bold text-slate-900">
                    {attempt.rawScore}/{attempt.totalQuestions}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Percentage</p>
                  <p className="text-lg font-bold text-slate-900">{pct}%</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Answer review */}
        <h2 className="mt-8 text-lg font-semibold text-slate-900">Answer review</h2>
        <div className="mt-4 space-y-3">
          {rows.map((r) => {
            const opts = (r.question.options as string[] | null) ?? null;
            const yours = fmtResponse(r.response, opts);
            const correct = fmtCorrect(r.question.correctAnswers, opts);
            return (
              <div
                key={r.id}
                className={`rounded-xl border p-4 ${
                  r.isCorrect ? "border-emerald-200 bg-emerald-50/40" : "border-red-200 bg-red-50/40"
                }`}
              >
                <div className="flex items-start gap-3">
                  {r.isCorrect ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      <span className="text-slate-400">{r.question.order}.</span>{" "}
                      {r.question.prompt}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
                      <span className="text-slate-600">
                        Your answer:{" "}
                        <strong className={r.isCorrect ? "text-emerald-700" : "text-red-600"}>
                          {yours}
                        </strong>
                      </span>
                      {!r.isCorrect && (
                        <span className="text-slate-600">
                          Correct: <strong className="text-emerald-700">{correct}</strong>
                        </span>
                      )}
                    </div>
                    {r.question.explanation && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white/70 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                          Explanation
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-slate-700">
                          {r.question.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex gap-3">
          <Link
            href={isModule ? `/test/${attempt.test.slug}?module=${attempt.module}` : `/test/${attempt.test.slug}`}
            className="rounded-lg bg-brand-600 text-white text-sm font-medium px-5 py-2.5 hover:bg-brand-700"
          >
            Retry
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-slate-300 text-sm font-medium px-5 py-2.5 hover:bg-slate-50"
          >
            Back to home
          </Link>
        </div>
      </main>
    </div>
  );
}
