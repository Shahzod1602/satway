"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Trash2, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface TestData {
  id: string;
  title: string;
  slug: string;
  skill: string;
  type: string;
  description: string | null;
  durationSec: number;
  published: boolean;
  sections: {
    id: string;
    order: number;
    title: string | null;
    instructions: string | null;
    passageText: string | null;
    imageUrl: string | null;
    formulaSheet: boolean;
    questions: {
      id: string;
      order: number;
      type: string;
      groupTitle: string | null;
      prompt: string | null;
      options: unknown;
      correctAnswers: unknown;
      points: number;
      meta: unknown;
    }[];
  }[];
}

export default function TestEditClient({ test }: { test: TestData }) {
  const router = useRouter();
  const [json, setJson] = useState(() => JSON.stringify(test, null, 2));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const parsed = JSON.parse(json);
      const res = await fetch(`/api/admin/tests/${test.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ ok: true, msg: "Test updated successfully" });
      } else {
        setFeedback({ ok: false, msg: data.error || "Failed to update" });
      }
    } catch (e) {
      setFeedback({ ok: false, msg: `Invalid JSON: ${(e as Error).message}` });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!confirm("Delete this test permanently? This cannot be undone.")) return;
    setDeleting(true);
    setFeedback(null);
    const res = await fetch(`/api/admin/tests/${test.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin");
    } else {
      const data = await res.json();
      setFeedback({ ok: false, msg: data.error || "Failed to delete" });
      setDeleting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Back to admin
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Edit test</h1>
          <p className="mt-1 text-sm text-slate-500">
            {test.title} &middot; {test.skill} &middot; {test.published ? "Published" : "Draft"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      {feedback && (
        <div
          className={`mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm ${
            feedback.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
          }`}
        >
          {feedback.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {feedback.msg}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-[#EAEAEA] bg-white p-6">
        <p className="mb-3 text-sm text-slate-500">
          Edit the test JSON below. Changes to fields like <code>title</code>, <code>slug</code>,{" "}
          <code>skill</code>, <code>published</code>, and <code>description</code> will be applied.
        </p>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          rows={30}
          className="w-full rounded-xl border border-[#EAEAEA] bg-slate-50 p-4 font-mono text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
    </div>
  );
}
