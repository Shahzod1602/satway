"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Type in the real Google invoice once a month.
 *
 * Without this every cost figure on the board is the rate card's guess. The rate card is
 * a model of Google's pricing, not a record of what they charged — and the whole point of
 * storing priceRev on every row is that when the drift shows up here, the history can be
 * re-priced instead of thrown away.
 */
export default function BillForm() {
  const router = useRouter();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
      setMsg("Saved.");
      router.refresh();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
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
      {msg && <span className="text-xs text-slate-500">{msg}</span>}
    </form>
  );
}
