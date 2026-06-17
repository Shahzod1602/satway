"use client";

import { useState } from "react";
import { PREMIUM_PLANS, getPlan, fmtUZS } from "@/lib/plans";
import PaymentForm from "./PaymentForm";
import { Crown, CheckCircle2 } from "lucide-react";

export default function PricingSelector({
  currentPlan,
  referralCode,
  cardNumber,
  cardHolder,
  paymentTelegram,
}: {
  currentPlan: string;
  referralCode: string;
  cardNumber: string;
  cardHolder: string;
  paymentTelegram: string;
}) {
  const [selected, setSelected] = useState<string>("1m");
  const [showPayment, setShowPayment] = useState(false);
  const isPremium = currentPlan === "PREMIUM";

  const plan = getPlan(selected);

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {PREMIUM_PLANS.map((p) => {
          const active = selected === p.id;
          return (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              className={`relative rounded-2xl border p-5 text-left transition-all ${
                active
                  ? "border-brand-600 bg-brand-50 shadow-sm"
                  : "border-[#EAEAEA] bg-white hover:border-slate-300"
              }`}
            >
              {p.popular && (
                <span className="absolute -top-2.5 right-4 rounded-full bg-accent-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-accent-700">
                  Popular
                </span>
              )}
              <p className="font-semibold text-slate-900">{p.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{fmtUZS(p.total)} UZS</p>
              <p className="mt-1 text-xs text-slate-500">
                {p.discount}% off · {fmtUZS(Math.round(p.total / p.months))}/month
              </p>
              {isPremium && (
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Current
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!isPremium && (
        <button
          onClick={() => setShowPayment(true)}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Crown className="h-4 w-4" /> Continue with {plan?.label}
        </button>
      )}

      {showPayment && plan && (
        <PaymentForm
          plan={plan}
          referralCode={referralCode}
          cardNumber={cardNumber}
          cardHolder={cardHolder}
          paymentTelegram={paymentTelegram}
          onClose={() => setShowPayment(false)}
        />
      )}
    </>
  );
}
