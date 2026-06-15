"use client";

import type { ClientQuestion } from "@/lib/types";
import { optionValue } from "@/lib/grading";

export default function QuestionInput({
  question,
  value,
  onChange,
}: {
  question: ClientQuestion;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
}) {
  const { type, options } = question;

  if (type === "STUDENT_PRODUCED_RESPONSE") {
    return (
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Enter your answer (e.g. 12.5 or 3/2)"
        className="w-full max-w-md rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
      />
    );
  }

  if (options && options.length > 0) {
    return (
      <div className="space-y-2">
        {options.map((opt) => {
          const v = optionValue(opt);
          const checked = value === v;
          return (
            <label
              key={opt}
              className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer text-sm ${
                checked
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-200 hover:bg-slate-50"
              }`}
            >
              <input
                type="radio"
                name={question.id}
                checked={checked}
                onChange={() => onChange(v)}
                className="accent-brand-600 w-4 h-4"
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>
    );
  }

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
