"use client";

import { useState } from "react";
import { Share2, Copy, Check, Trash2, Users, UserPlus, ChevronDown } from "lucide-react";

export type ShareLinkData = {
  id: string;
  token: string;
  kind: "FRIEND" | "CLASS";
  active: boolean;
  maxUses: number | null;
  test: { title: string; slug: string };
  count: number;
  redeemers: { name: string; score: number | null; raw: number | null; total: number | null }[];
};

type TestOpt = { id: string; title: string; skill: string };

export default function SharesClient({ tests, initialLinks }: { tests: TestOpt[]; initialLinks: ShareLinkData[] }) {
  const [links, setLinks] = useState(initialLinks);
  const [testId, setTestId] = useState(tests[0]?.id ?? "");
  const [kind, setKind] = useState<"FRIEND" | "CLASS">("FRIEND");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const urlFor = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/s/${token}` : `/s/${token}`;

  async function generate() {
    if (!testId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, kind }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not create link");
      const l = data.link;
      setLinks((prev) => [
        { id: l.id, token: l.token, kind: l.kind, active: l.active, maxUses: l.maxUses, test: { title: l.test.title, slug: l.test.slug }, count: 0, redeemers: [] },
        ...prev,
      ]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setLinks((prev) => prev.map((x) => (x.id === id ? { ...x, active: false } : x)));
    await fetch(`/api/share/${id}`, { method: "DELETE" }).catch(() => {});
  }

  function copy(token: string, id: string) {
    navigator.clipboard?.writeText(urlFor(token));
    setCopied(id);
    setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  }

  return (
    <main className="px-6 pt-6 pb-10">
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-600"><Share2 className="h-5 w-5" /></span>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Share tests</h1>
          <p className="text-sm text-slate-500">Invite a friend to a premium test — or run a whole class.</p>
        </div>
      </div>

      {/* Create panel */}
      <div className="mt-6 max-w-2xl rounded-2xl border border-[#EAEAEA] bg-white p-5">
        <label className="text-xs font-medium uppercase tracking-wide text-slate-400">Test</label>
        <select
          value={testId}
          onChange={(e) => setTestId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        >
          {tests.map((t) => (
            <option key={t.id} value={t.id}>{t.title}</option>
          ))}
        </select>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            onClick={() => setKind("FRIEND")}
            className={`rounded-xl border p-3 text-left transition-colors ${kind === "FRIEND" ? "border-brand-600 bg-brand-50/60 ring-1 ring-brand-600" : "border-slate-200 hover:border-slate-300"}`}
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><UserPlus className="h-4 w-4 text-brand-600" /> Friend link</span>
            <p className="mt-1 text-xs text-slate-500">Up to 3 people can take this test.</p>
          </button>
          <button
            onClick={() => setKind("CLASS")}
            className={`rounded-xl border p-3 text-left transition-colors ${kind === "CLASS" ? "border-brand-600 bg-brand-50/60 ring-1 ring-brand-600" : "border-slate-200 hover:border-slate-300"}`}
          >
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900"><Users className="h-4 w-4 text-brand-600" /> Class link</span>
            <p className="mt-1 text-xs text-slate-500">Unlimited — for a whole group.</p>
          </button>
        </div>

        <button
          onClick={generate}
          disabled={busy || !testId}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Generate link"}
        </button>
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>

      {/* Links list */}
      <h2 className="mt-8 text-sm font-semibold text-slate-900">Your links</h2>
      {links.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">No share links yet — generate one above.</p>
      ) : (
        <div className="mt-3 max-w-2xl space-y-3">
          {links.map((l) => (
            <div key={l.id} className={`rounded-2xl border bg-white p-4 ${l.active ? "border-[#EAEAEA]" : "border-slate-200 opacity-60"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{l.test.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${l.kind === "FRIEND" ? "bg-brand-50 text-brand-700" : "bg-amber-50 text-amber-700"}`}>
                      {l.kind === "FRIEND" ? "Friend" : "Class"}
                    </span>
                    <span className="text-slate-500">
                      {l.count}{l.maxUses ? `/${l.maxUses}` : ""} joined
                    </span>
                    {!l.active && <span className="text-red-500">revoked</span>}
                  </div>
                </div>
                {l.active && (
                  <button onClick={() => revoke(l.id)} title="Revoke" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>

              {l.active && (
                <div className="mt-3 flex items-center gap-2">
                  <input readOnly value={urlFor(l.token)} className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600" />
                  <button onClick={() => copy(l.token, l.id)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                    {copied === l.id ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy</>}
                  </button>
                </div>
              )}

              {l.count > 0 && (
                <div className="mt-3">
                  <button onClick={() => setOpen((o) => (o === l.id ? null : l.id))} className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800">
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open === l.id ? "rotate-180" : ""}`} /> Results ({l.count})
                  </button>
                  {open === l.id && (
                    <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {l.redeemers.map((r, i) => (
                        <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="text-slate-700">{r.name}</span>
                          <span className="tabular-nums font-semibold text-slate-900">
                            {r.score != null ? r.score : r.raw != null ? `${r.raw}/${r.total}` : <span className="text-xs font-normal text-slate-400">not taken yet</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
