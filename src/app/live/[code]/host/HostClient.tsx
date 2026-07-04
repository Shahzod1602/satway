"use client";

import { useEffect, useState } from "react";
import { Radio, Copy, Check, Users, Play, Loader2 } from "lucide-react";

export default function HostClient({
  code,
  testTitle,
  initialStatus,
}: {
  code: string;
  testTitle: string;
  initialStatus: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [names, setNames] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);
  const joinUrl = typeof window !== "undefined" ? `${window.location.origin}/live/${code}` : `/live/${code}`;

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/live/${code}`, { cache: "no-store" });
        if (!res.ok || stopped) return;
        const d = await res.json();
        setStatus(d.status);
        setNames(d.participants.map((p: { name: string }) => p.name));
      } catch {
        /* keep polling */
      }
    };
    poll();
    const id = setInterval(poll, 2500);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [code]);

  async function start() {
    if (starting) return;
    setStarting(true);
    try {
      const res = await fetch(`/api/live/${code}/start`, { method: "POST" });
      if (res.ok) setStatus("LIVE");
    } finally {
      setStarting(false);
    }
  }

  function copy() {
    navigator.clipboard?.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const live = status === "LIVE";

  return (
    <div className="min-h-screen bg-[#FBFAF7] px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center gap-2 text-brand-600">
          <Radio className="h-4 w-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">{live ? "Live now" : "Live session · lobby"}</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{testTitle}</h1>

        {/* Join code / link */}
        {!live && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Join code</p>
            <p className="mt-1 font-display text-5xl font-bold tracking-[0.15em] text-slate-900">{code}</p>
            <div className="mx-auto mt-4 flex max-w-md items-center gap-2">
              <input readOnly value={joinUrl} className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600" />
              <button onClick={copy} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                {copied ? <><Check className="h-3.5 w-3.5" /> Copied</> : <><Copy className="h-3.5 w-3.5" /> Copy link</>}
              </button>
            </div>
            <p className="mt-3 text-xs text-slate-400">Share this with your students. They wait here until you start.</p>
          </div>
        )}

        {/* Participants */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900"><Users className="h-4 w-4 text-brand-600" /> In the room</span>
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-sm font-bold text-brand-700">{names.length}</span>
          </div>
          {names.length === 0 ? (
            <p className="mt-3 text-sm text-slate-400">Waiting for students to join…</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {names.map((n, i) => (
                <span key={i} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">{n}</span>
              ))}
            </div>
          )}
        </div>

        {/* Start */}
        {live ? (
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 text-center">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700"><Loader2 className="h-4 w-4 animate-spin" /> Live — {names.length} student{names.length === 1 ? "" : "s"} taking the test.</p>
          </div>
        ) : (
          <button
            onClick={start}
            disabled={starting || names.length === 0}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-4 text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            <Play className="h-5 w-5" /> {starting ? "Starting…" : `Start test for everyone${names.length ? ` (${names.length})` : ""}`}
          </button>
        )}
      </div>
    </div>
  );
}
