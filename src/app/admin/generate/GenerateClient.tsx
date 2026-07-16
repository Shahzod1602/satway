"use client";

import { useState } from "react";
import MathText from "@/components/MathText";

type Generated = {
  type: string;
  prompt: string;
  options?: string[];
  correctAnswers: string[];
  explanation?: string;
};

export default function GenerateClient() {
  const [passage, setPassage] = useState("");
  const [skill, setSkill] = useState<"READING_WRITING" | "MATH">("READING_WRITING");
  const [count, setCount] = useState("5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Generated[] | null>(null);
  const [kept, setKept] = useState<Set<number>>(new Set());

  async function generate() {
    setBusy(true);
    setError(null);
    setQuestions(null);
    try {
      const res = await fetch("/api/admin/generate-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passage, skill, count: Number(count) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setQuestions(data.questions);
      // Nothing is kept by default. An "everything checked" default turns review into a
      // rubber stamp, which is exactly how a wrong answer key reaches a student.
      setKept(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const toggle = (i: number) =>
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  const keptJson = questions
    ? JSON.stringify(
        questions.filter((_, i) => kept.has(i)),
        null,
        2,
      )
    : "";

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium text-slate-700">Passage / source material</label>
        <textarea
          value={passage}
          onChange={(e) => setPassage(e.target.value)}
          rows={8}
          maxLength={20000}
          placeholder="Paste a reading passage, or a description of the math topic to build questions around…"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs text-slate-900"
        />
        <p className="mt-1 text-xs text-slate-500">{passage.length} / 20000 characters</p>

        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-xs text-slate-500">
            Section
            <select
              value={skill}
              onChange={(e) => setSkill(e.target.value as typeof skill)}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              <option value="READING_WRITING">Reading &amp; Writing</option>
              <option value="MATH">Math</option>
            </select>
          </label>
          <label className="text-xs text-slate-500">
            How many
            <input
              value={count}
              onChange={(e) => setCount(e.target.value)}
              type="number"
              min="1"
              max="20"
              className="mt-1 block w-20 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <button
            onClick={generate}
            disabled={busy || passage.trim().length < 20}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Generating…" : "Generate"}
          </button>
          {error && <span className="text-sm text-rose-600">{error}</span>}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          This is an admin AI call — it lands on the cost board under &ldquo;Admin — question
          generation&rdquo;, separate from what students cost.
        </p>
      </div>

      {questions && (
        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-900">
              {questions.length} generated · {kept.size} kept
            </h2>
            <button
              onClick={() => setKept(new Set(questions.map((_, i) => i)))}
              className="text-xs font-medium text-slate-500 hover:text-slate-800"
            >
              Keep all
            </button>
          </div>

          <div className="mt-3 space-y-3">
            {questions.map((q, i) => (
              <div
                key={i}
                className={`rounded-xl border bg-white p-4 transition-colors ${
                  kept.has(i) ? "border-emerald-300 bg-emerald-50/30" : "border-slate-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={kept.has(i)}
                    onChange={() => toggle(i)}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300"
                  />
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      {q.type}
                    </span>
                    <div className="mt-1 text-sm text-slate-800">
                      <MathText>{q.prompt}</MathText>
                    </div>
                    {q.options && (
                      <ul className="mt-2 space-y-1">
                        {q.options.map((o, j) => (
                          <li key={j} className="text-sm text-slate-600">
                            <MathText>{o}</MathText>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2 text-sm">
                      <span className="font-semibold text-emerald-700">
                        Answer: {q.correctAnswers.join(" or ")}
                      </span>
                    </div>
                    {q.explanation && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-medium text-slate-500">
                          Explanation — check the maths
                        </summary>
                        <div className="mt-1 text-sm text-slate-600">
                          <MathText>{q.explanation}</MathText>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {kept.size > 0 && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-sm font-medium text-slate-700">
                {kept.size} question{kept.size === 1 ? "" : "s"} kept — paste into the test
                builder
              </p>
              <p className="mt-1 text-xs text-slate-500">
                The builder on /admin takes a whole test definition; drop these into its
                questions array.
              </p>
              <textarea
                readOnly
                value={keptJson}
                rows={8}
                onFocus={(e) => e.currentTarget.select()}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700"
              />
              <button
                onClick={() => navigator.clipboard?.writeText(keptJson)}
                className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700"
              >
                Copy JSON
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
