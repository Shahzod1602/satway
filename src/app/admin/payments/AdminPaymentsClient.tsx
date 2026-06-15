"use client";

import { useState } from "react";
import { Check, X, Loader2, Clock } from "lucide-react";
import { fmtUZS } from "@/lib/plans";

type Payment = {
  id: string;
  planLabel: string;
  months: number;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  createdAt: string;
  user: { name: string; email: string; plan: string; premiumUntil: string | null };
};

const statusStyles: Record<Payment["status"], string> = {
  PENDING: "bg-amber-50 text-amber-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  REJECTED: "bg-red-50 text-red-600",
};

export default function AdminPaymentsClient({ initial }: { initial: Payment[] }) {
  const [payments, setPayments] = useState<Payment[]>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const review = async (id: string, action: "approve" | "reject") => {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update payment");
      } else {
        setPayments((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: data.status } : p)),
        );
      }
    } catch {
      setError("Network error");
    }
    setBusy(null);
  };

  const pendingCount = payments.filter((p) => p.status === "PENDING").length;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
      <p className="mt-1 text-sm text-slate-500">
        {pendingCount} pending · {payments.length} total
      </p>

      {error && (
        <div className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</div>
      )}

      <div className="mt-6 space-y-3">
        {payments.map((p) => (
          <div
            key={p.id}
            className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#EAEAEA] bg-white p-5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{p.user.name}</span>
                <span className="text-sm text-slate-400">{p.user.email}</span>
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {p.months} month{p.months !== 1 ? "s" : ""} · {fmtUZS(p.amount)} UZS ·{" "}
                {new Date(p.createdAt).toLocaleString()}
              </div>
              {p.note && <div className="mt-1 text-sm text-slate-600">“{p.note}”</div>}
            </div>

            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[p.status]}`}
            >
              {p.status === "PENDING" && <Clock className="h-3 w-3" />}
              {p.status}
            </span>

            {p.status === "PENDING" && (
              <div className="flex gap-2">
                <button
                  onClick={() => review(p.id, "approve")}
                  disabled={busy === p.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  {busy === p.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  Approve
                </button>
                <button
                  onClick={() => review(p.id, "reject")}
                  disabled={busy === p.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}

        {payments.length === 0 && (
          <div className="rounded-2xl border border-[#EAEAEA] bg-white px-6 py-12 text-center text-slate-400">
            No payments yet.
          </div>
        )}
      </div>
    </div>
  );
}
