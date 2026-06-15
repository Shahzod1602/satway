"use client";

import Link from "next/link";
import { Award, TrendingUp, Sparkles, Target, CalendarClock } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import BandChart from "@/components/BandChart";

interface AttemptData {
  id: string;
  scaledScore: number | null;
  rawScore: number;
  totalQuestions: number;
  submittedAt: string;
  test: { title: string; skill: string };
}

export default function ProgressClient({
  user,
  attempts,
  goals,
  plan,
}: {
  user: { name: string; role: string };
  attempts: AttemptData[];
  goals: { targetScore: number | null; examDate: string | null };
  plan?: string;
}) {
  const scored = attempts
    .filter((a) => a.scaledScore != null)
    .map((a) => a.scaledScore as number);
  const avgScore = scored.length
    ? Math.round(scored.reduce((s, b) => s + b, 0) / scored.length)
    : null;
  const bestScore = scored.length ? Math.max(...scored) : null;

  const targetGap =
    goals.targetScore != null && bestScore != null
      ? Math.max(0, goals.targetScore - bestScore)
      : null;
  const daysToExam = goals.examDate
    ? Math.ceil((new Date(goals.examDate).getTime() - Date.now()) / 86400000)
    : null;
  const targetPct =
    goals.targetScore != null && bestScore != null
      ? Math.min(100, Math.round((bestScore / goals.targetScore) * 100))
      : 0;

  const chartData = attempts
    .filter((a) => a.scaledScore != null)
    .map((a, i) => ({
      name: `#${i + 1}`,
      band: a.scaledScore ?? 0,
    }));

  return (
    <div className="flex min-h-screen bg-[#FFFDFB]">
      <Sidebar name={user.name} role={user.role} plan={plan} />

      <div className="min-w-0 flex-1">
        <main className="px-6 pt-6 pb-10">
          <h1 className="text-2xl font-bold text-slate-900">Progress</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your score history and test results over time.
          </p>

          {goals.targetScore != null || goals.examDate != null ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {goals.targetScore != null && (
                <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                      <Target className="h-4 w-4 text-brand-600" /> Target score
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      {bestScore ?? "—"} / {goals.targetScore}
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
                      style={{ width: `${targetPct}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {targetGap === 0
                      ? "Target reached!"
                      : targetGap != null
                        ? `${targetGap} points to go`
                        : "No attempts yet"}
                  </p>
                </div>
              )}
              {goals.examDate != null && (
                <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-slate-600">
                    <CalendarClock className="h-4 w-4 text-accent-600" /> Exam date
                  </span>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {daysToExam != null && daysToExam >= 0
                      ? `${daysToExam} days left`
                      : "Exam date has passed"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {goals.examDate &&
                      new Date(goals.examDate).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl border border-dashed border-[#EAEAEA] bg-white p-5">
              <p className="text-sm text-slate-500">
                Set a target score and exam date to track your goal.
              </p>
              <Link
                href="/profile"
                className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Set a goal
              </Link>
            </div>
          )}

          {attempts.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[#EAEAEA] bg-white p-12 text-center">
              <p className="text-sm text-slate-400">
                You haven&apos;t taken any tests yet.{" "}
                <Link href="/dashboard" className="font-medium text-brand-600 hover:underline">
                  Start a test
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
                      <Award className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Tests completed</p>
                      <p className="text-2xl font-bold text-slate-900">{attempts.length}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
                      <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Average score</p>
                      <p className="text-2xl font-bold text-slate-900">{avgScore ?? "—"}</p>
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent-50 text-accent-600">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Highest score</p>
                      <p className="text-2xl font-bold text-slate-900">{bestScore ?? "—"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[#EAEAEA] bg-white p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-900">Score history</h2>
                <BandChart data={chartData} />
              </div>

              <h2 className="mt-10 text-lg font-semibold text-slate-900">Recent attempts</h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#EAEAEA] bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">Test</th>
                      <th className="px-4 py-3">Skill</th>
                      <th className="px-4 py-3">Correct</th>
                      <th className="px-4 py-3">Score</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAEAEA]">
                    {[...attempts].reverse().map((a) => (
                      <tr key={a.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm text-slate-900">{a.test.title}</td>
                        <td className="px-4 py-3 text-sm text-slate-500">
                          {a.test.skill === "MATH" ? "Math" : "Reading & Writing"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600">
                          {a.rawScore}/{a.totalQuestions}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-brand-600">
                          {a.scaledScore ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/results/${a.id}`}
                            className="text-xs font-medium text-slate-500 transition-colors hover:text-brand-600"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
