"use client";

import { useState } from "react";
import Link from "next/link";
import { Users, LifeBuoy, FilePlus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

export default function AdminPanel() {
  const [json, setJson] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleCreate = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const parsed = JSON.parse(json);
      const res = await fetch("/api/admin/tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ ok: true, msg: `Test created: ${data.title || data.id}` });
        setJson("");
      } else {
        setFeedback({ ok: false, msg: data.error || "Failed to create test" });
      }
    } catch (e) {
      setFeedback({ ok: false, msg: `Invalid JSON: ${(e as Error).message}` });
    }
    setLoading(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Admin Panel</h1>
      <p className="mt-1 text-sm text-slate-500">Manage users, support tickets, and tests.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link
          href="/admin/users"
          className="rounded-2xl border border-[#EAEAEA] bg-white p-6 transition-all hover:border-brand-300 hover:shadow-sm"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <Users className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Manage users</h3>
          <p className="mt-1 text-sm text-slate-500">View all registered students</p>
        </Link>

        <Link
          href="/admin/support"
          className="rounded-2xl border border-[#EAEAEA] bg-white p-6 transition-all hover:border-brand-300 hover:shadow-sm"
        >
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Support tickets</h3>
          <p className="mt-1 text-sm text-slate-500">Reply to student messages</p>
        </Link>

        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent-50 text-accent-600">
            <FilePlus className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Create test</h3>
          <p className="mt-1 text-sm text-slate-500">Build a new test with the form below</p>
        </div>
      </div>

      <div className="mt-10 rounded-2xl border border-[#EAEAEA] bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Test Builder</h2>
        <p className="mt-1 text-sm text-slate-500">
          Paste a JSON test definition. The JSON must include <code>title</code>, <code>slug</code>,{" "}
          <code>skill</code> (READING_WRITING or MATH), and <code>sections</code> with questions.
        </p>

        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={16}
          placeholder={`{
  "title": "Algebra Practice 1",
  "slug": "algebra-1",
  "skill": "MATH",
  "type": "DIGITAL",
  "description": "Basic algebra practice",
  "durationSec": 2400,
  "sections": [
    {
      "order": 1,
      "title": "Module 1",
      "questions": [
        {
          "order": 1,
          "type": "MCQ_SINGLE",
          "prompt": "What is 2x + 5 = 15?",
          "options": ["A) 3", "B) 5", "C) 10", "D) 7"],
          "correctAnswers": ["B"]
        }
      ]
    }
  ]
}`}
          className="mt-4 w-full rounded-xl border border-[#EAEAEA] bg-slate-50 p-4 font-mono text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />

        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleCreate}
            disabled={loading || !json.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus className="h-4 w-4" />}
            Create Test
          </button>

          {feedback && (
            <div
              className={`inline-flex items-center gap-2 text-sm ${
                feedback.ok ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {feedback.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
              {feedback.msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
