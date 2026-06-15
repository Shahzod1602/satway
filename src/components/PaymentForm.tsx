"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PremiumPlan } from "@/lib/plans";
import { fmtUZS } from "@/lib/plans";
import { X, CheckCircle2 } from "lucide-react";

export default function PaymentForm({
  plan,
  cardNumber,
  cardHolder,
  onClose,
}: {
  plan: PremiumPlan;
  referralCode: string;
  cardNumber: string;
  cardHolder: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitPayment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not submit payment. Please try again.");
        setLoading(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-30 bg-black/40 grid place-items-center px-5">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>

        {submitted ? (
          <div className="py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <h3 className="mt-3 font-bold text-lg text-slate-900">Payment submitted</h3>
            <p className="mt-2 text-sm text-slate-600">
              Thanks! Our admin will verify your transfer and activate Premium shortly.
              You&apos;ll see it reflected on your dashboard once approved.
            </p>
            <button
              onClick={() => router.push("/dashboard")}
              className="mt-5 px-5 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
            >
              Go to dashboard
            </button>
          </div>
        ) : (
        <>
        <h3 className="font-bold text-lg text-slate-900">Complete payment</h3>
        <p className="mt-2 text-sm text-slate-600">
          {plan.label} plan — <strong>{fmtUZS(plan.total)} UZS</strong>
        </p>

        <div className="mt-4 rounded-xl bg-slate-50 p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Plan:</span>
            <span className="font-medium">{plan.label}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Discount:</span>
            <span className="font-medium text-accent-600">{plan.discount}%</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="font-semibold">Total:</span>
            <span className="font-bold text-slate-900">{fmtUZS(plan.total)} UZS</span>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            Transfer to the card
          </p>
          <p className="text-lg font-mono font-bold text-slate-900">{cardNumber}</p>
          <p className="text-sm text-slate-500">{cardHolder}</p>
        </div>

        <div className="mt-4 rounded-xl bg-amber-50 p-3 flex gap-2 text-sm text-amber-700">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>After transferring, click &quot;I&apos;ve paid&quot; — our admin will verify and activate your Premium access.</span>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={submitPayment}
            disabled={loading}
            className="px-5 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-60"
          >
            {loading ? "Submitting…" : "I've paid"}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
