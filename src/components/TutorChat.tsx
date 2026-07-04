"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Sparkles, Send, Loader2, Lock, X } from "lucide-react";
import MathText from "@/components/MathText";

type Turn = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "Why is my answer wrong?",
  "Explain this simply",
  "Give me a similar question",
];

export default function TutorChat({
  questionId,
  attemptId,
  isPremium,
  wasCorrect,
}: {
  questionId: string;
  attemptId: string;
  isPremium: boolean;
  wasCorrect: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, loading]);

  // Free users see an upsell instead of the chat.
  if (!isPremium) {
    return (
      <Link
        href="/upgrade"
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
      >
        <Lock className="h-3.5 w-3.5" /> Ask the AI tutor · Premium
      </Link>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100"
      >
        <Sparkles className="h-3.5 w-3.5" /> Ask the AI tutor
      </button>
    );
  }

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || loading) return;
    setError(null);
    setInput("");
    const history = turns;
    setTurns((t) => [...t, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, attemptId, message: msg, history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "The tutor is unavailable right now.");
      setTurns((t) => [...t, { role: "assistant", content: data.reply as string }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-brand-200 bg-brand-50/40">
      <div className="flex items-center justify-between border-b border-brand-100 px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700">
          <Sparkles className="h-3.5 w-3.5" /> AI tutor
        </span>
        <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-600">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div ref={scrollRef} className="max-h-72 overflow-y-auto px-3 py-3 space-y-3">
        {turns.length === 0 && (
          <p className="text-xs text-slate-500">
            Ask anything about this question — I&apos;ll explain{" "}
            {wasCorrect ? "the reasoning" : "where it went wrong"} in your language.
          </p>
        )}
        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                t.role === "user"
                  ? "bg-brand-600 text-white"
                  : "bg-white text-slate-800 border border-slate-200"
              }`}
            >
              <MathText>{t.content}</MathText>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          </div>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      {turns.length === 0 && (
        <div className="flex flex-wrap gap-2 px-3 pb-2">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={loading}
              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-600 hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 border-t border-brand-100 p-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the tutor…"
          maxLength={1000}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
