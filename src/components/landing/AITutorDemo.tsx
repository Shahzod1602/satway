"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { Sparkles } from "lucide-react";

// One real SAT-style item, explained in plain English — step by step.
const ASK = "Why is my answer (5) wrong?";
const ANSWER =
  "In 3x − 7 = 14, first add 7 to both sides: 3x = 21. Then divide by 3: x = 7. You got 5 because you divided before adding 7 — add first, then divide. The correct answer is 7. Want to try one more like it?";

export default function AITutorDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });

  return (
    <div ref={ref} className="mx-auto w-full max-w-md">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
        <div className="flex items-center gap-2.5 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-white">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">Tutor</p>
            <p className="text-[11px] text-emerald-600">● online · 24/7</p>
          </div>
        </div>

        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Question 12 · Algebra</p>
          <p className="mt-1 text-sm font-medium text-slate-800">If 3x − 7 = 14, what is x?</p>
          <div className="mt-2 flex gap-2 text-xs">
            <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 font-medium text-red-500 line-through">B) 5</span>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-medium text-emerald-600">C) 7 ✓</span>
          </div>
        </div>

        <Conversation ask={ASK} answer={ANSWER} active={inView} />
      </div>
    </div>
  );
}

// The student question + the typewriter tutor reply. Fresh state per mount, so no
// state is reset synchronously inside an effect.
function Conversation({ ask, answer, active }: { ask: string; answer: string; active: boolean }) {
  const reduce = useReducedMotion();
  const [typed, setTyped] = useState(reduce ? answer : "");
  const [thinking, setThinking] = useState(!reduce);
  const done = typed.length >= answer.length;

  useEffect(() => {
    if (!active || reduce) return;
    let typer: ReturnType<typeof setInterval> | undefined;
    const start = setTimeout(() => {
      setThinking(false);
      let i = 0;
      typer = setInterval(() => {
        i += 1;
        setTyped(answer.slice(0, i));
        if (i >= answer.length && typer) clearInterval(typer);
      }, 16);
    }, 700);
    return () => {
      clearTimeout(start);
      if (typer) clearInterval(typer);
    };
  }, [active, reduce, answer]);

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand-600 px-3.5 py-2 text-sm text-white">{ask}</div>
      </div>
      <div className="flex justify-start">
        <div className="max-w-[88%] rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm leading-relaxed text-slate-800">
          {thinking ? (
            <span className="inline-flex gap-1 py-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
            </span>
          ) : (
            <>
              {typed}
              {!done && <span className="ml-0.5 inline-block w-1.5 animate-pulse text-brand-500">▌</span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
