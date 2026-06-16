"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Coffee, ArrowRight } from "lucide-react";
import ExamRunner, { type MockResult } from "./ExamRunner";
import type { ClientExamMeta } from "@/lib/types";

const BREAK_SECONDS = 10 * 60; // 10-minute break between the two sections

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MockRunner({
  tests,
  userName,
}: {
  tests: ClientExamMeta[];
  userName: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = R&W, 1 = Math
  const [onBreak, setOnBreak] = useState(false);
  const [rwResult, setRwResult] = useState<MockResult | null>(null);

  const currentTest = tests[step];

  if (onBreak) {
    return <BreakScreen onResume={() => { setOnBreak(false); setStep(1); }} />;
  }

  if (!currentTest) {
    router.push("/progress");
    return null;
  }

  return (
    <ExamRunner
      key={currentTest.id}
      test={currentTest}
      userName={userName}
      mode="full"
      mockMode
      mockProgress={{ step: step + 1, total: tests.length }}
      onSubmitted={(r) => {
        if (step === 0) {
          setRwResult(r);
          setOnBreak(true);
        } else {
          const total = (rwResult?.scaledScore ?? 0) + (r.scaledScore ?? 0);
          alert(
            `Mock complete!\nReading & Writing: ${rwResult?.scaledScore ?? "—"}\nMath: ${r.scaledScore ?? "—"}\nTotal: ${total}`,
          );
          router.push("/progress");
        }
      }}
    />
  );
}

function BreakScreen({ onResume }: { onResume: () => void }) {
  const [left, setLeft] = useState(BREAK_SECONDS);

  useEffect(() => {
    const id = setInterval(() => setLeft((t) => (t <= 0 ? 0 : t - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (left === 0) onResume();
  }, [left, onResume]);

  return (
    <div className="grid h-screen place-items-center bg-slate-50 px-6">
      <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-accent-50 text-accent-600">
          <Coffee className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">Break time</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
          You finished the <strong>Reading &amp; Writing</strong> section. Take a short break —
          the <strong>Math</strong> section begins automatically when the timer ends.
        </p>
        <div className="mt-6 text-4xl font-bold tabular-nums text-slate-900">{fmt(left)}</div>
        <button
          onClick={onResume}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Skip break · Start Math <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
