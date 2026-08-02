"use client";

import { useState } from "react";
import Link from "next/link";
import { Target, CheckCircle2, XCircle, ArrowRight, RotateCcw, Sparkles } from "lucide-react";
import type { ClientQuestion } from "@/lib/types";
import type { SatQuestionType } from "@/lib/grading";
import { gradeAnswer } from "@/lib/grading";
import QuestionInput from "@/components/exam/QuestionInput";
import MathText from "@/components/MathText";
import TutorChat from "@/components/TutorChat";

export type ReviewQuestion = {
  id: string;
  attemptId: string;
  type: SatQuestionType;
  prompt: string | null;
  options: string[] | null;
  correctAnswers: string[];
  explanation: string | null;
  imageUrl: string | null;
  topic: string;
};

export default function ReviewClient({
  questions,
  topics,
  isPremium,
}: {
  questions: ReviewQuestion[];
  topics: { topic: string; count: number }[];
  isPremium: boolean;
}) {
  const [phase, setPhase] = useState<"start" | "quiz" | "done">("start");
  const [idx, setIdx] = useState(0);
  const [answer, setAnswer] = useState<string | string[] | undefined>(undefined);
  const [checked, setChecked] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);

  const q = questions[idx];

  function check() {
    if (answer == null || answer === "" || checked) return;
    if (gradeAnswer(q.type, q.correctAnswers, answer)) setCorrectCount((c) => c + 1);
    setChecked(true);
  }
  function next() {
    if (idx + 1 >= questions.length) {
      setPhase("done");
      return;
    }
    setIdx((i) => i + 1);
    setAnswer(undefined);
    setChecked(false);
  }
  function restart() {
    setIdx(0);
    setAnswer(undefined);
    setChecked(false);
    setCorrectCount(0);
    setPhase("quiz");
  }

  const header = (
    <div>
      <h1 className="text-2xl font-bold text-slate-900">Review your mistakes</h1>
      <p className="mt-1 text-sm text-slate-500">
        Re-practice the questions you last got wrong — the fastest way to raise your score.
      </p>
    </div>
  );

  // ── Empty ──
  if (questions.length === 0) {
    return (
      <main className="px-6 pt-6 pb-10">
        {header}
        <div className="mt-8 rounded-2xl border border-dashed border-[var(--border)] bg-white p-12 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <p className="mt-3 text-sm text-slate-600">
            Nothing to review — you haven&apos;t missed any questions yet. Take a test to build your review set.
          </p>
          <Link href="/dashboard" className="mt-4 inline-flex rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            Go to tests
          </Link>
        </div>
      </main>
    );
  }

  // ── Start ──
  if (phase === "start") {
    return (
      <main className="px-6 pt-6 pb-10">
        {header}
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-6">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
              <Target className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-slate-900">{questions.length}</p>
              <p className="text-sm text-slate-500">questions to review</p>
            </div>
          </div>
          {topics.length > 0 && (
            <div className="mt-5">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Weakest areas</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {topics.slice(0, 6).map((t) => (
                  <span key={t.topic} className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    {t.topic} · {t.count}
                  </span>
                ))}
              </div>
            </div>
          )}
          <button
            onClick={() => setPhase("quiz")}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Start practice <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    );
  }

  // ── Done ──
  if (phase === "done") {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <main className="px-6 pt-6 pb-10">
        {header}
        <div className="mt-6 rounded-2xl border border-[var(--border)] bg-white p-8 text-center">
          <p className="text-5xl font-extrabold text-brand-600">{correctCount}<span className="text-2xl text-slate-400">/{questions.length}</span></p>
          <p className="mt-2 text-sm text-slate-500">correct this time ({pct}%)</p>
          <p className="mx-auto mt-3 max-w-sm text-sm text-slate-600">
            {pct >= 80 ? "Great — those concepts are sticking." : "Keep drilling these — repetition is what moves the score."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={restart} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
              <RotateCcw className="h-4 w-4" /> Review again
            </button>
            <Link href="/progress" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              View progress
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── Quiz ──
  const cq: ClientQuestion = {
    id: q.id,
    order: 0,
    type: q.type,
    groupTitle: null,
    stimulus: null,
    imageUrl: q.imageUrl,
    prompt: q.prompt,
    options: q.options,
    meta: null,
  };
  const isCorrect = checked && gradeAnswer(q.type, q.correctAnswers, answer);
  const last = idx + 1 >= questions.length;

  return (
    <main className="px-6 pt-6 pb-10">
      {header}
      <div className="mt-6 max-w-2xl">
        <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-400">
          <span>Question {idx + 1} of {questions.length}</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5">{q.topic}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${((idx) / questions.length) * 100}%` }} />
        </div>

        <div className="mt-5 rounded-2xl border border-[var(--border)] bg-white p-6">
          {q.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={q.imageUrl} alt="" className="mb-4 w-full max-w-md rounded-lg border border-slate-200" />
          )}
          {q.prompt && (
            <p className="text-[16px] leading-relaxed text-slate-900">
              <MathText>{q.prompt}</MathText>
            </p>
          )}
          <div className="mt-5">
            <QuestionInput
              question={cq}
              value={answer}
              onChange={checked ? () => {} : setAnswer}
            />
          </div>

          {!checked ? (
            <button
              onClick={check}
              disabled={answer == null || answer === ""}
              className="mt-5 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Check answer
            </button>
          ) : (
            <div className="mt-5">
              <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${isCorrect ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                {isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {isCorrect ? "Correct!" : "Not quite."}
                {!isCorrect && (
                  <span className="font-normal text-slate-600">
                    Answer: <strong className="text-emerald-700"><MathText>{q.correctAnswers.join(" or ")}</MathText></strong>
                  </span>
                )}
              </div>
              {q.explanation && (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Explanation</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700"><MathText>{q.explanation}</MathText></p>
                </div>
              )}
              <TutorChat questionId={q.id} attemptId={q.attemptId} isPremium={isPremium} wasCorrect={!!isCorrect} />
              <button
                onClick={next}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {last ? "Finish" : "Next question"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {!isPremium && (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-slate-400">
            <Sparkles className="h-3.5 w-3.5" /> Unlock the AI tutor on every question with Premium.
          </p>
        )}
      </div>
    </main>
  );
}
