"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AUDIENCES, AUDIENCE_LABELS, type Audience } from "@/lib/broadcastAudience";
import type { BroadcastChannel } from "@/lib/broadcastDeliver";

type Row = {
  id: string;
  body: string;
  audience: string;
  channels: string;
  createdAt: string;
  recipients: number;
  inappSent: number;
  telegramSent: number;
  telegramFailed: number;
  emailSent: number;
  emailFailed: number;
  deliveredAt: string | null;
};

type Reach = { inapp: number; telegram: number; email: number };

const CHANNEL_LABELS: Record<BroadcastChannel, string> = {
  inapp: "In-app",
  telegram: "Telegram",
  email: "Email",
};

export default function BroadcastClient({ initialHistory }: { initialHistory: Row[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<Audience>("ALL");
  const [channels, setChannels] = useState<BroadcastChannel[]>(["inapp"]);
  const [reach, setReach] = useState<Reach | null>(null);
  const [recipients, setRecipients] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const toggle = (c: BroadcastChannel) => {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
    setReach(null); // the preview is stale the moment the channels change
  };

  async function post(dry: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, audience, channels, dry }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      if (dry) {
        setReach(data.reach);
        setRecipients(data.recipients);
      } else {
        setMsg(
          data.background
            ? `Sent to ${data.recipients} people. Telegram and email are going out in the background — refresh the history in a minute.`
            : `Sent to ${data.recipients} people.`,
        );
        setBody("");
        setReach(null);
        setRecipients(null);
        router.refresh();
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canPreview = body.trim().length > 0 && channels.length > 0;

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium text-slate-700">Message</label>
        <textarea
          value={body}
          onChange={(e) => {
            setBody(e.target.value);
            setReach(null);
          }}
          rows={6}
          maxLength={4000}
          placeholder={"New tests are live.\n\nWe've added 10 new adaptive Math papers…"}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
        <p className="mt-1 text-xs text-slate-500">
          The first line becomes the email subject. Plain text — blank lines make paragraphs.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-slate-700">Audience</label>
            <select
              value={audience}
              onChange={(e) => {
                setAudience(e.target.value as Audience);
                setReach(null);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              {AUDIENCES.filter((a) => a !== "USERS").map((a) => (
                <option key={a} value={a}>
                  {AUDIENCE_LABELS[a]}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">Admins are never included.</p>
          </div>

          <div>
            <span className="block text-sm font-medium text-slate-700">Channels</span>
            <div className="mt-2 flex flex-wrap gap-3">
              {(Object.keys(CHANNEL_LABELS) as BroadcastChannel[]).map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={channels.includes(c)}
                    onChange={() => toggle(c)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {CHANNEL_LABELS[c]}
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              In-app reaches everyone but only when they next open the site.
            </p>
          </div>
        </div>

        {reach && (
          <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
            <strong>{recipients} people</strong> match this audience. This will actually reach:{" "}
            {channels.map((c) => `${reach[c]} by ${CHANNEL_LABELS[c].toLowerCase()}`).join(", ")}.
            {channels.includes("email") && reach.email < (recipients ?? 0) && (
              <span className="mt-1 block text-xs">
                {(recipients ?? 0) - reach.email} have email off or a Telegram-only account.
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => post(true)}
            disabled={busy || !canPreview}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
          >
            {busy ? "…" : "Preview reach"}
          </button>
          <button
            onClick={() => post(false)}
            disabled={busy || !reach}
            title={!reach ? "Preview the reach first" : undefined}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Sending…" : "Send"}
          </button>
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Send is deliberately gated behind Preview — there is no undo on a broadcast.
        </p>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-900">History</h2>
        <div className="mt-3 space-y-2">
          {initialHistory.length === 0 && (
            <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-400">
              Nothing sent yet.
            </p>
          )}
          {initialHistory.map((b) => (
            <div key={b.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {AUDIENCE_LABELS[b.audience as Audience] ?? b.audience} · {b.channels}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(b.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {b.body.length > 240 ? `${b.body.slice(0, 240)}…` : b.body}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>{b.recipients} matched</span>
                {b.inappSent > 0 && <span>{b.inappSent} in-app</span>}
                {b.telegramSent > 0 && <span>{b.telegramSent} telegram</span>}
                {b.telegramFailed > 0 && (
                  <span className="text-rose-600">{b.telegramFailed} telegram failed</span>
                )}
                {b.emailSent > 0 && <span>{b.emailSent} email</span>}
                {b.emailFailed > 0 && (
                  <span className="text-rose-600">{b.emailFailed} email failed</span>
                )}
                {!b.deliveredAt && <span className="text-amber-600">delivery pending…</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
