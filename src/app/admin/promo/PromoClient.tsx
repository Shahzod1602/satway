"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fmtUZS } from "@/lib/plans";

type Row = {
  id: string;
  code: string;
  percentOff: number;
  commissionPct: number;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  active: boolean;
  note: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  soldCount: number;
  revenue: number;
  commissionOwed: number;
};

export default function PromoClient({ initialCodes }: { initialCodes: Row[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [percentOff, setPercentOff] = useState("20");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [commissionPct, setCommissionPct] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          percentOff: Number(percentOff),
          ownerEmail: ownerEmail || undefined,
          commissionPct: commissionPct ? Number(commissionPct) : undefined,
          maxUses: maxUses ? Number(maxUses) : undefined,
          note: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setMsg({ ok: true, text: `${data.code.code} created.` });
      setCode("");
      setOwnerEmail("");
      setCommissionPct("");
      setMaxUses("");
      setNote("");
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(row: Row) {
    await fetch(`/api/admin/promo/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !row.active }),
    });
    router.refresh();
  }

  async function remove(row: Row) {
    if (!confirm(`Delete ${row.code}?`)) return;
    const res = await fetch(`/api/admin/promo/${row.id}`, { method: "DELETE" });
    const data = await res.json();
    if (data.message) setMsg({ ok: true, text: data.message });
    router.refresh();
  }

  const totalOwed = initialCodes.reduce((s, c) => s + c.commissionOwed, 0);

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={create} className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-800">New code</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="text-xs text-slate-500">
            Code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="TEACHER20"
              required
              pattern="[A-Za-z0-9_-]{3,40}"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase text-slate-900"
            />
          </label>
          <label className="text-xs text-slate-500">
            Discount %
            <input
              value={percentOff}
              onChange={(e) => setPercentOff(e.target.value)}
              type="number"
              min="1"
              max="100"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs text-slate-500">
            Max uses (blank = unlimited)
            <input
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              type="number"
              min="1"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs text-slate-500">
            Owner email (blank = plain marketing code)
            <input
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              type="email"
              placeholder="teacher@example.com"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs text-slate-500">
            Commission % (needs an owner)
            <input
              value={commissionPct}
              onChange={(e) => setCommissionPct(e.target.value)}
              type="number"
              min="0"
              max="100"
              placeholder="50"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-xs text-slate-500">
            Note
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tashkent centre, spring"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create code"}
          </button>
          {msg && (
            <span className={`text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>
              {msg.text}
            </span>
          )}
        </div>
      </form>

      {totalOwed > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>{fmtUZS(totalOwed)} so&apos;m</strong> in commission owed across all codes.
          Payouts are manual — this page is the record of what is due.
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Code</th>
              <th className="px-4 py-2 font-medium">Off</th>
              <th className="px-4 py-2 font-medium">Owner</th>
              <th className="px-4 py-2 font-medium">Comm.</th>
              <th className="px-4 py-2 font-medium">Used</th>
              <th className="px-4 py-2 font-medium">Sold</th>
              <th className="px-4 py-2 font-medium">Revenue</th>
              <th className="px-4 py-2 font-medium">Owed</th>
              <th className="px-4 py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {initialCodes.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-4 text-slate-400">
                  No codes yet.
                </td>
              </tr>
            )}
            {initialCodes.map((c) => (
              <tr key={c.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2">
                  <span
                    className={`font-mono font-semibold ${c.active ? "text-slate-900" : "text-slate-400 line-through"}`}
                  >
                    {c.code}
                  </span>
                  {c.note && <div className="text-xs text-slate-400">{c.note}</div>}
                </td>
                <td className="px-4 py-2 text-slate-700">{c.percentOff}%</td>
                <td className="px-4 py-2 text-xs text-slate-600">
                  {c.ownerName ? (
                    <>
                      {c.ownerName}
                      <div className="text-slate-400">{c.ownerEmail}</div>
                    </>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-700">{c.commissionPct ? `${c.commissionPct}%` : "—"}</td>
                <td className="px-4 py-2 text-slate-600">
                  {c.usedCount}
                  {c.maxUses ? ` / ${c.maxUses}` : ""}
                </td>
                <td className="px-4 py-2 tabular-nums text-slate-700">{c.soldCount || "—"}</td>
                <td className="px-4 py-2 tabular-nums text-slate-700">
                  {c.revenue ? fmtUZS(c.revenue) : "—"}
                </td>
                <td className="px-4 py-2 font-semibold tabular-nums text-amber-700">
                  {c.commissionOwed ? fmtUZS(c.commissionOwed) : "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  <button
                    onClick={() => toggle(c)}
                    className="mr-2 text-xs font-medium text-slate-500 hover:text-slate-800"
                  >
                    {c.active ? "Disable" : "Enable"}
                  </button>
                  <button
                    onClick={() => remove(c)}
                    className="text-xs font-medium text-rose-500 hover:text-rose-700"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
