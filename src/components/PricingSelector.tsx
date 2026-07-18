"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crown, Tag, Check, X, Loader2 } from "lucide-react";
import { PREMIUM_PLANS as PLANS, BASE_MONTHLY, fmtUZS as fmt } from "@/lib/plans";

const discounted = (amount: number, pct: number) => Math.round((amount * (100 - pct)) / 100);

export default function PricingSelector() {
  const router = useRouter();
  const [selected, setSelected] = useState(PLANS[1]?.id ?? PLANS[0].id); // default to popular

  // Promo code. The discount shown here is only a preview — the amount actually charged is
  // recomputed from the code server-side at checkout, so a hand-edited URL buys nothing.
  const [code, setCode] = useState("");
  const [applied, setApplied] = useState<{ code: string; pct: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const applyPromo = async () => {
    const c = code.trim();
    if (!c || checking) return;
    setChecking(true);
    setError("");
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // satway's validate is plan-scoped; the percentage it returns is plan-independent,
        // so the applied discount survives the learner switching plans below.
        body: JSON.stringify({ code: c, planId: selected }),
      });
      const data = await res.json();
      if (data.valid) {
        setApplied({ code: data.code, pct: data.percentOff });
      } else {
        setApplied(null);
        setError(data.reason || "Invalid or expired promo code.");
      }
    } catch {
      setApplied(null);
      setError("Couldn't check the code — please try again.");
    } finally {
      setChecking(false);
    }
  };

  const clearPromo = () => {
    setApplied(null);
    setCode("");
    setError("");
  };

  const goToCheckout = () => {
    const q = new URLSearchParams({ plan: selected });
    if (applied) q.set("promo", applied.code);
    router.push(`/upgrade/pay?${q}`);
  };

  return (
    <div>
      <p className="text-center text-sm text-slate-500">No commitment, cancel anytime</p>

      {/* Promo code sits above the plans: down by the button it was easy to scroll past, and a
          learner who has a code should be able to enter it before reading any price — every card
          below then shows what they'd actually pay. */}
      <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Tag className="h-4 w-4 text-brand-600" /> Promo code
        </h2>

        {applied ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium text-emerald-800">
              <Check className="h-4 w-4 shrink-0" />
              Promo code applied — you saved {applied.pct}%.
            </span>
            <button
              type="button"
              onClick={clearPromo}
              className="shrink-0 text-emerald-700 hover:text-emerald-900"
              aria-label="Remove promo code"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <div className="mt-3 flex gap-2">
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                placeholder="Enter promo code"
                aria-label="Promo code"
                aria-invalid={!!error}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm uppercase tracking-wide outline-none placeholder:normal-case placeholder:tracking-normal focus:border-brand-500"
              />
              <button
                type="button"
                onClick={applyPromo}
                disabled={!code.trim() || checking}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {checking && <Loader2 className="h-4 w-4 animate-spin" />}
                Apply
              </button>
            </div>
            {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
          </>
        )}
      </div>

      <div className="mt-5 space-y-3">
        {PLANS.map((p) => {
          // With a promo on, the plan's own price becomes the "before" figure and the promo
          // price is what the learner pays — so the saving is visible on the card they pick.
          const total = applied ? discounted(p.total, applied.pct) : p.total;
          const perMonth = Math.round(total / p.months);
          const wasTotal = applied ? p.total : BASE_MONTHLY * p.months;
          const showWas = applied ? true : p.discount > 0;
          const isSel = selected === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelected(p.id)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl border-2 bg-white px-5 py-4 text-left transition-colors ${
                isSel ? "border-slate-900" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                    isSel ? "border-slate-900" : "border-slate-300"
                  }`}
                >
                  {isSel && <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-900">{p.label}</span>
                    {p.popular && (
                      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">{fmt(perMonth)} UZS / month</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-right">
                <div>
                  <span className="text-xl font-extrabold text-slate-900">{fmt(total)}</span>
                  <span className="ml-0.5 text-xs text-slate-400">UZS</span>
                </div>
                {showWas && (
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-slate-400 line-through">{fmt(wasTotal)}</span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">
                      −{applied ? applied.pct : p.discount}%
                    </span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={goToCheckout}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-700"
      >
        <Crown className="h-4 w-4" /> Get Premium
      </button>
      <p className="mt-3 text-center text-xs text-slate-400">
        Pay with Visa/Mastercard, card transfer — more methods coming soon · fast activation
      </p>
    </div>
  );
}
