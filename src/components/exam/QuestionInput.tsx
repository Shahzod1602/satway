"use client";

import type { ClientQuestion } from "@/lib/types";
import { optionValue } from "@/lib/grading";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Strip a leading "A) " / "B. " label from an option for clean display. */
function optionLabel(opt: string): string {
  return opt.replace(/^\s*([A-Za-z]{1,4}|\d{1,2})[).]\s*/, "").trim();
}

export default function QuestionInput({
  question,
  value,
  onChange,
  crossedOut = [],
  onToggleCrossOut,
}: {
  question: ClientQuestion;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
  crossedOut?: string[];
  onToggleCrossOut?: (optionValue: string) => void;
}) {
  const { type, options } = question;

  // Math grid-in / free response
  if (type === "STUDENT_PRODUCED_RESPONSE") {
    return (
      <div>
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Enter your answer"
          inputMode="text"
          className="w-full max-w-xs rounded-lg border border-slate-300 px-4 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <p className="mt-2 text-xs text-slate-400">
          Enter as a number, fraction (e.g. 3/2), or decimal (e.g. 1.5).
        </p>
      </div>
    );
  }

  if (options && options.length > 0) {
    return (
      <div className="space-y-3">
        {options.map((opt, i) => {
          const v = optionValue(opt);
          const checked = value === v;
          const struck = crossedOut.includes(v);
          const letter = LETTERS[i] ?? v;
          return (
            <div key={opt} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (struck) onToggleCrossOut?.(v); // restore then allow selecting
                  else onChange(v);
                }}
                aria-pressed={checked}
                className={`group flex flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] transition-colors ${
                  checked
                    ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                    : struck
                      ? "border-slate-200 bg-slate-50 opacity-50"
                      : "border-slate-300 hover:border-slate-400 hover:bg-slate-50"
                }`}
              >
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border text-sm font-semibold ${
                    checked
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-slate-400 text-slate-600"
                  }`}
                >
                  {letter}
                </span>
                <span className={struck ? "text-slate-400 line-through" : "text-slate-800"}>
                  {optionLabel(opt)}
                </span>
              </button>

              {onToggleCrossOut && (
                <button
                  type="button"
                  onClick={() => onToggleCrossOut(v)}
                  title={struck ? "Undo cross out" : "Cross out answer"}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border text-xs font-bold transition-colors ${
                    struck
                      ? "border-slate-300 bg-slate-100 text-slate-500"
                      : "border-transparent text-slate-300 hover:border-slate-300 hover:text-slate-600"
                  }`}
                >
                  <span className={struck ? "" : "line-through"}>{letter}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // Fallback free-text
  return (
    <input
      type="text"
      value={typeof value === "string" ? value : ""}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Your answer"
      className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
    />
  );
}
