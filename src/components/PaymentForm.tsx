"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PremiumPlan } from "@/lib/plans";
import { fmtUZS, fmtUSD, CARD_FEE_USD_CENTS } from "@/lib/plans";
import { X, CheckCircle2, Send } from "lucide-react";

export default function PaymentForm({
  plan,
  cardNumber,
  cardHolder,
  paymentTelegram,
  clickEnabled,
  paymeEnabled,
  visaEnabled,
  onClose,
}: {
  plan: PremiumPlan;
  cardNumber: string;
  cardHolder: string;
  paymentTelegram: string;
  clickEnabled: boolean;
  paymeEnabled: boolean;
  visaEnabled: boolean;
  onClose: () => void;
}) {
  // e.g. "https://t.me/identify_admin" → "@identify_admin"
  const tgHandle = paymentTelegram
    ? "@" + paymentTelegram.replace(/\/+$/, "").split("/").pop()
    : "";
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Automated providers first: a flow that grants in seconds should never sit behind
  // the one that needs a human to read a screenshot.
  const [method, setMethod] = useState<"payme" | "click" | "visa" | "transfer">(
    paymeEnabled ? "payme" : clickEnabled ? "click" : visaEnabled ? "visa" : "transfer",
  );
  const providerCount = Number(paymeEnabled) + Number(clickEnabled) + Number(visaEnabled);

  // Promo. `applied` is only ever set from the SERVER's answer — the amount shown here
  // is the one the server computed, never one this component worked out for itself.
  const [promo, setPromo] = useState("");
  const [applied, setApplied] = useState<{ code: string; percentOff: number; amount: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);

  const total = applied?.amount ?? plan.total;

  // Visa (Polar) charges USD. Mirrors the server's formula in /api/payment/polar —
  // display only; the server recomputes and locks the real amount into the checkout.
  const visaPlanUsd = Math.round((plan.totalUsd * (100 - (applied?.percentOff ?? 0))) / 100);
  const visaTotalUsd = visaPlanUsd + CARD_FEE_USD_CENTS;

  const checkPromo = async () => {
    if (!promo.trim()) return;
    setCheckingPromo(true);
    setPromoMsg(null);
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promo.trim(), planId: plan.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoMsg(data.error ?? "Could not check that code.");
      } else if (data.valid) {
        setApplied({ code: data.code, percentOff: data.percentOff, amount: data.amount });
        setPromoMsg(null);
      } else {
        setApplied(null);
        setPromoMsg(data.reason);
      }
    } catch {
      setPromoMsg("Network error. Try again.");
    }
    setCheckingPromo(false);
  };

  const submitPayment = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/profile/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The code, not the price. The server re-derives the amount — see lib/checkout.
        body: JSON.stringify({ planId: plan.id, promoCode: applied?.code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not submit payment. Please try again.");
        setLoading(false);
        return;
      }
      setOrderNo(data.orderNo ?? null);
      setSubmitted(true);
    } catch {
      setError("Network error. Please try again.");
    }
    setLoading(false);
  };

  // One redirect flow for every automated provider — the return URL lands on
  // /upgrade/success, which polls until the webhook's grant is visible.
  const payWithProvider = async (provider: "click" | "payme" | "polar") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/payment/${provider}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, promoCode: applied?.code }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data.error || "This method is unavailable right now. Try the card transfer.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
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
            {/* The order number is the whole reason the manual flow is workable: without a
                reference, an admin matching a screenshot to an account is guessing. */}
            {orderNo && (
              <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Your order number</p>
                <p className="mt-0.5 font-mono text-xl font-bold text-slate-900">{orderNo}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Send this with your receipt so we can find your transfer.
                </p>
              </div>
            )}
            <p className="mt-3 text-sm text-slate-600">
              Thanks! Make sure you&apos;ve sent the payment receipt
              {tgHandle ? ` to ${tgHandle} on Telegram` : ""}. Our admin will verify your
              transfer and activate Premium shortly. You&apos;ll see it reflected on your
              dashboard once approved.
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
          {plan.label} plan — <strong>{fmtUZS(total)} UZS</strong>
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
          {applied && (
            <div className="flex justify-between">
              <span className="text-slate-500">
                Code <span className="font-mono font-semibold">{applied.code}</span>:
              </span>
              <span className="font-medium text-emerald-600">
                −{applied.percentOff}% ({fmtUZS(plan.total - applied.amount)} off)
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="font-semibold">Total:</span>
            <span className="font-bold text-slate-900">
              {applied && (
                <span className="mr-2 font-normal text-slate-400 line-through">
                  {fmtUZS(plan.total)}
                </span>
              )}
              {fmtUZS(total)} UZS
            </span>
          </div>
        </div>

        <div className="mt-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Promo code
          </label>
          <div className="mt-1 flex gap-2">
            <input
              value={promo}
              onChange={(e) => {
                setPromo(e.target.value.toUpperCase());
                setApplied(null); // any edit invalidates the server's answer
                setPromoMsg(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void checkPromo();
                }
              }}
              placeholder="If your teacher gave you one"
              maxLength={40}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400"
            />
            <button
              type="button"
              onClick={checkPromo}
              disabled={checkingPromo || !promo.trim() || !!applied}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 disabled:opacity-50"
            >
              {checkingPromo ? "…" : applied ? "Applied" : "Apply"}
            </button>
          </div>
          {promoMsg && <p className="mt-1 text-xs text-rose-600">{promoMsg}</p>}
        </div>

        {providerCount > 0 && (
          <div className={`mt-4 grid gap-2 ${providerCount === 2 ? "grid-cols-3" : "grid-cols-2"}`}>
            {(
              [
                ...(paymeEnabled ? [{ id: "payme" as const, label: "Payme", sub: "Avtomatik" }] : []),
                ...(clickEnabled ? [{ id: "click" as const, label: "Click", sub: "Avtomatik" }] : []),
                ...(visaEnabled ? [{ id: "visa" as const, label: "Visa karta", sub: "USD, avtomatik" }] : []),
                { id: "transfer" as const, label: "Karta o'tkazma", sub: "Admin tasdiqlaydi" },
              ]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={`rounded-xl border p-3 text-left transition-colors ${
                  method === m.id
                    ? "border-brand-600 bg-brand-50"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="block text-sm font-semibold text-slate-900">{m.label}</span>
                <span className="block text-xs text-slate-500">{m.sub}</span>
              </button>
            ))}
          </div>
        )}

        {(method === "payme" && paymeEnabled) || (method === "click" && clickEnabled) ? (
          <>
            <div
              className={`mt-4 rounded-xl border p-4 text-sm text-slate-700 ${
                method === "payme"
                  ? "border-[#33CCCC]/30 bg-[#33CCCC]/5"
                  : "border-[#0072FF]/20 bg-[#0072FF]/5"
              }`}
            >
              Uzcard, Humo{method === "payme" ? " yoki Visa" : ""} bilan to&apos;laysiz —{" "}
              {method === "payme" ? "Payme" : "Click"} tasdiqlashi bilan Premium{" "}
              <strong>avtomatik, bir necha soniyada</strong> yoqiladi. Chek yuborish, admin
              kutish yo&apos;q.
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
                onClick={() => payWithProvider(method as "click" | "payme")}
                disabled={loading}
                className={`px-5 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60 ${
                  method === "payme"
                    ? "bg-[#31b3b3] hover:bg-[#2aa0a0]"
                    : "bg-[#0072FF] hover:bg-[#005fd6]"
                }`}
              >
                {loading
                  ? "Yo'naltirilmoqda…"
                  : `${method === "payme" ? "Payme" : "Click"} orqali to'lash — ${fmtUZS(total)} UZS`}
              </button>
            </div>
          </>
        ) : method === "visa" && visaEnabled ? (
          <>
            <div className="mt-4 rounded-xl border border-slate-900/15 bg-slate-900/[0.04] p-4 text-sm text-slate-700">
              Xalqaro Visa yoki Mastercard bilan <strong>USD&apos;da</strong> to&apos;laysiz —
              to&apos;lov o&apos;tishi bilan Premium <strong>avtomatik, bir necha soniyada</strong>{" "}
              yoqiladi. Chek yuborish, admin kutish yo&apos;q.
            </div>

            <div className="mt-3 rounded-xl bg-slate-50 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Plan ({plan.label}):</span>
                <span className="font-medium">{fmtUSD(visaPlanUsd)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Card fee:</span>
                <span className="font-medium">{fmtUSD(CARD_FEE_USD_CENTS)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-1.5">
                <span className="font-semibold">Total:</span>
                <span className="font-bold text-slate-900">{fmtUSD(visaTotalUsd)}</span>
              </div>
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
                onClick={() => payWithProvider("polar")}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? "Yo'naltirilmoqda…" : `Karta orqali to'lash — ${fmtUSD(visaTotalUsd)}`}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
                Transfer to the card
              </p>
              <p className="text-lg font-mono font-bold text-slate-900">{cardNumber}</p>
              <p className="text-sm text-slate-500">{cardHolder}</p>
            </div>

            {tgHandle && (
              <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm">
                <p className="flex items-center gap-2 font-semibold text-brand-700">
                  <Send className="h-4 w-4 shrink-0" /> Send your payment receipt
                </p>
                <p className="mt-1 text-slate-600">
                  After transferring, send the check (screenshot) to our admin on Telegram:
                </p>
                <a
                  href={paymentTelegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <Send className="h-3.5 w-3.5" /> {tgHandle}
                </a>
              </div>
            )}

            <div className="mt-4 rounded-xl bg-amber-50 p-3 flex gap-2 text-sm text-amber-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>After sending the receipt, click &quot;I&apos;ve paid&quot; — our admin will verify and activate your Premium access.</span>
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
        </>
        )}
      </div>
    </div>
  );
}
