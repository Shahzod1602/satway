"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Test = {
  id: string;
  title: string;
  slug: string;
  skill: string;
  type: string;
  published: boolean;
  isPremium: boolean;
  level: string;
  createdAt: string;
  _count: { sections: number; attempts: number };
};

const LEVELS = ["EASY", "MEDIUM", "HARD"] as const;
const LEVEL_TEXT: Record<string, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };

const SKILLS = ["ALL", "READING_WRITING", "MATH"] as const;

export default function TestsClient({ initialTests }: { initialTests: Test[] }) {
  const router = useRouter();
  const [tests, setTests] = useState(initialTests);
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState<(typeof SKILLS)[number]>("ALL");
  const [onlyDraft, setOnlyDraft] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return tests.filter(
      (t) =>
        (skill === "ALL" || t.skill === skill) &&
        (!onlyDraft || !t.published) &&
        (!needle ||
          t.title.toLowerCase().includes(needle) ||
          t.slug.toLowerCase().includes(needle)),
    );
  }, [tests, q, skill, onlyDraft]);

  async function toggle(t: Test, field: "published" | "isPremium") {
    setBusy(t.id);
    try {
      const res = await fetch(`/api/admin/tests/${t.id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: !t[field] }),
      });
      if (res.ok) {
        // Update in place rather than refetching: a publish toggle should feel instant,
        // and the server's answer is authoritative for exactly this row.
        const { test } = await res.json();
        setTests((prev) =>
          prev.map((x) =>
            x.id === t.id ? { ...x, published: test.published, isPremium: test.isPremium } : x,
          ),
        );
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function changeLevel(t: Test, level: string) {
    if (level === t.level) return;
    const prevLevel = t.level;
    // Optimistic: reflect the choice immediately, roll back if the write fails.
    setTests((prev) => prev.map((x) => (x.id === t.id ? { ...x, level } : x)));
    setBusy(t.id);
    try {
      const res = await fetch(`/api/admin/tests/${t.id}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level }),
      });
      if (!res.ok) {
        setTests((prev) => prev.map((x) => (x.id === t.id ? { ...x, level: prevLevel } : x)));
      } else {
        router.refresh();
      }
    } catch {
      setTests((prev) => prev.map((x) => (x.id === t.id ? { ...x, level: prevLevel } : x)));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title or slug…"
          className="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
        <select
          value={skill}
          onChange={(e) => setSkill(e.target.value as (typeof SKILLS)[number])}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
        >
          {SKILLS.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All sections" : s === "READING_WRITING" ? "Reading & Writing" : "Math"}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={onlyDraft}
            onChange={(e) => setOnlyDraft(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300"
          />
          Drafts only
        </label>
      </div>

      <p className="mt-2 text-xs text-slate-500">
        Showing {shown.length} of {tests.length}.
      </p>

      <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Test</th>
              <th className="px-4 py-2 font-medium">Section</th>
              <th className="px-4 py-2 font-medium">Modules</th>
              <th className="px-4 py-2 font-medium">Level</th>
              <th className="px-4 py-2 font-medium">Attempts</th>
              <th className="px-4 py-2 font-medium">Published</th>
              <th className="px-4 py-2 font-medium">Premium</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-slate-400">
                  Nothing matches.
                </td>
              </tr>
            )}
            {shown.map((t) => (
              <tr key={t.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800">{t.title}</div>
                  <div className="font-mono text-xs text-slate-400">{t.slug}</div>
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {t.skill === "READING_WRITING" ? "R&W" : "Math"}
                </td>
                <td
                  className={`px-4 py-2 tabular-nums ${t._count.sections === 0 ? "font-semibold text-rose-600" : "text-slate-600"}`}
                  title={t._count.sections === 0 ? "No sections — this test cannot be taken" : undefined}
                >
                  {t._count.sections}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={t.level}
                    onChange={(e) => changeLevel(t, e.target.value)}
                    disabled={busy === t.id}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 disabled:opacity-50"
                    aria-label={`Level for ${t.title}`}
                  >
                    {LEVELS.map((lv) => (
                      <option key={lv} value={lv}>
                        {LEVEL_TEXT[lv]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2 tabular-nums text-slate-600">{t._count.attempts || "—"}</td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggle(t, "published")}
                    disabled={busy === t.id}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                      t.published
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {t.published ? "Live" : "Draft"}
                  </button>
                </td>
                <td className="px-4 py-2">
                  <button
                    onClick={() => toggle(t, "isPremium")}
                    disabled={busy === t.id}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
                      t.isPremium ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {t.isPremium ? "Premium" : "Free"}
                  </button>
                </td>
                <td className="px-4 py-2 text-right">
                  <Link
                    href={`/admin/test/${t.id}/edit`}
                    className="text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
