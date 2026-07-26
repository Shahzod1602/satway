"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface BillRow {
  month: string;
  actualUsd: number;
  estimatedUsd: number;
}

/**
 * Type in the real Google invoice once a month — and see every reconciled month.
 *
 * Without this every cost figure on the board is the rate card's guess. The rate card is
 * a model of Google's pricing, not a record of what they charged — and the whole point of
 * storing priceRev on every row is that when the drift shows up here, the history can be
 * re-priced instead of thrown away.
 *
 * The history list below the form is fetched from GET /api/admin/ai-bill (previously only
 * the single latest row was visible, from getGlance()).
 */
export default function BillForm() {
  const router = useRouter();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [history, setHistory] = useState<BillRow[]>([]);

  const loadHistory = () =>
    fetch("/api/admin/ai-bill?limit=12")
      .then((r) => r.json())
      .then((d) => {
        if (d?.ok && Array.isArray(d.items)) setHistory(d.items);
      })
      .catch(() => {});

  useEffect(() => {
    loadHistory();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/ai-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, actualUsd: Number(amount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setAmount("");
      setMsg({ ok: true, text: "Saved." });
      loadHistory();
      router.refresh();
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          Month
          <input
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="2026-07"
            pattern="\d{4}-\d{2}"
            required
            className="mt-1 block w-28 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
        </label>
        <label className="text-xs text-slate-500">
          Real invoice (USD)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="0.00"
            className="mt-1 block w-32 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {busy ? "Saving…" : "Record invoice"}
        </button>
        {msg && (
          <span className={msg.ok ? "text-xs text-emerald-600" : "text-xs text-rose-600"}>
            {msg.text}
          </span>
        )}
      </form>

      {history.length > 0 && (
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-100">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-1.5 font-medium">Month</th>
                <th className="px-3 py-1.5 text-right font-medium">Invoice</th>
                <th className="px-3 py-1.5 text-right font-medium">Estimated</th>
                <th className="px-3 py-1.5 text-right font-medium">Drift</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => {
                const drift =
                  row.estimatedUsd > 0
                    ? ((row.actualUsd - row.estimatedUsd) / row.estimatedUsd) * 100
                    : null;
                return (
                  <tr key={row.month} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-medium text-slate-700">{row.month}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-800">
                      ${row.actualUsd.toFixed(2)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
                      ${row.estimatedUsd.toFixed(2)}
                    </td>
                    <td
                      className={`px-3 py-1.5 text-right tabular-nums ${
                        drift !== null && Math.abs(drift) > 15
                          ? "font-semibold text-rose-600"
                          : "text-slate-500"
                      }`}
                    >
                      {drift === null ? "—" : `${drift > 0 ? "+" : ""}${drift.toFixed(0)}%`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
