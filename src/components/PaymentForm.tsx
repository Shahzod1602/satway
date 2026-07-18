"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check, Send, CreditCard, Tag, Loader2, X, Globe, Zap, Lock } from "lucide-react";
import { fmtUZS, fmtUSD, CARD_FEE_USD_CENTS } from "@/lib/plans";

const groupCard = (n: string) => (n.replace(/\D/g, "").match(/.{1,4}/g) || []).join(" ");

/** Click.uz logomark — a rounded diamond with a punched-out center. */
function ClickLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <g transform="rotate(45 12 12)">
        <path
          fillRule="evenodd"
          d="M10 4.2h4a5.8 5.8 0 0 1 5.8 5.8v4a5.8 5.8 0 0 1-5.8 5.8h-4A5.8 5.8 0 0 1 4.2 14v-4A5.8 5.8 0 0 1 10 4.2Zm1.4 5.2a2.2 2.2 0 0 0-2.2 2.2v.8a2.2 2.2 0 0 0 2.2 2.2h1.2a2.2 2.2 0 0 0 2.2-2.2v-.8a2.2 2.2 0 0 0-2.2-2.2h-1.2Z"
        />
      </g>
    </svg>
  );
}

/**
 * Payme wordmark — dark "Pay" over the turquoise "me" banner. The word is the logo, so
 * it can't shrink to a 16px glyph like Click's diamond: it replaces the text label in
 * the tab instead of sitting beside it. "Pay" rides currentColor so it stays legible
 * when the tab flips to a dark fill; `mono` whites out the whole mark for use on a
 * solid brand button. textLength pins the letters inside the banner whatever font the
 * device actually resolves.
 */
function PaymeLogo({ className, mono = false }: { className?: string; mono?: boolean }) {
  const font = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  return (
    <svg viewBox="0 0 100 96" className={className} aria-label="Payme" role="img">
      <text
        x="2"
        y="42"
        textLength="86"
        lengthAdjust="spacingAndGlyphs"
        fontFamily={font}
        fontSize="46"
        fontWeight="700"
        fill="currentColor"
      >
        Pay
      </text>
      <path
        d="M4 52h78l14 20-14 20H4a4 4 0 0 1-4-4V56a4 4 0 0 1 4-4Z"
        fill={mono ? "currentColor" : "#5ECFCF"}
      />
      <text
        x="12"
        y="86"
        textLength="62"
        lengthAdjust="spacingAndGlyphs"
        fontFamily={font}
        fontSize="40"
        fontWeight="700"
        fill={mono ? "#00A3A3" : "#fff"}
      >
        me
      </text>
    </svg>
  );
}

type Method = "payme" | "click" | "transfer" | "visa";

// Provider tabs wear their own brand; the rest fall back to slate. `tab` is the
// selected fill (darkened from the logo colour so white text stays legible), `ink`
// tints the idle logo, `sub` the caption on the selected fill. Payme takes a dark
// fill, not its own turquoise — the wordmark's banner IS turquoise and would vanish.
const BRAND = {
  payme: { tab: "bg-slate-900", ink: "text-slate-900", sub: "text-slate-300" },
  click: { tab: "bg-[#0072FF]", ink: "text-[#0072FF]", sub: "text-blue-100" },
} as const;

export default function PaymentForm({
  planId,
  planLabel,
  amount,
  amountUsd,
  card,
  holder,
  telegramUrl,
  visaEnabled,
  clickEnabled,
  paymeEnabled,
  allowPromo = true,
  initialPromo = null,
}: {
  planId: string;
  planLabel: string;
  amount: number; // UZS
  amountUsd: number; // US cents
  card: string;
  holder: string;
  telegramUrl: string;
  visaEnabled: boolean;
  clickEnabled: boolean;
  paymeEnabled: boolean;
  allowPromo?: boolean;
  /** Code the learner already entered on the pricing page, carried in the url. */
  initialPromo?: string | null;
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  // Prefer an automated method that's actually live; fall back to manual transfer.
  const [method, setMethod] = useState<Method>(
    paymeEnabled ? "payme" : clickEnabled ? "click" : visaEnabled ? "visa" : "transfer",
  );

  // promo
  const [code, setCode] = useState(initialPromo ?? "");
  const [applied, setApplied] = useState<{ code: string; pct: number } | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  // Hosted checkout (Payme / Click / Polar)
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  // Manual transfer — creates a PENDING order an admin matches to the receipt. Keep the
  // server's recorded amount, not just the number: if the promo lapsed between the
  // pricing page and this submit, the server records list price and the success screen
  // must show that true figure rather than the stale discounted one on the card above.
  const [submitting, setSubmitting] = useState(false);
  const [manualOrder, setManualOrder] = useState<{ orderNo: string; amount: number | null } | null>(null);
  const [submitError, setSubmitError] = useState("");

  const finalAmount = applied ? Math.round((amount * (100 - applied.pct)) / 100) : amount;
  const finalUsd = applied ? Math.round((amountUsd * (100 - applied.pct)) / 100) : amountUsd;

  const validate = async (c: string) => {
    const res = await fetch("/api/promo/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: c, planId }),
    });
    return res.json();
  };

  const applyPromo = async () => {
    const c = code.trim();
    if (!c) return;
    setChecking(true);
    setError("");
    try {
      const data = await validate(c);
      if (data.valid) {
        setApplied({ code: data.code, pct: data.percentOff });
        setError("");
      } else {
        setApplied(null);
        setError(data.reason || "Invalid or expired promo code.");
      }
    } catch {
      setError("Couldn't check the code — please try again.");
    } finally {
      setChecking(false);
    }
  };

  // Re-validate the code that came in the url rather than trusting it. If it has expired
  // since the pricing page, the learner sees the error here instead of a wrong price.
  useEffect(() => {
    const c = initialPromo?.trim();
    if (!allowPromo || !c) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await validate(c);
        if (cancelled) return;
        if (data.valid) setApplied({ code: data.code, pct: data.percentOff });
        else setError(data.reason || "Invalid or expired promo code.");
      } catch {
        /* leave the box empty — the learner can retype it */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPromo, allowPromo]);

  const clearPromo = () => {
    setApplied(null);
    setCode("");
    setError("");
  };

  const copyCard = async () => {
    try {
      await navigator.clipboard.writeText(card.replace(/\D/g, ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  // Start a hosted checkout (Payme / Click / Polar) and follow the URL. satway auths
  // via the app session (no Telegram Mini App), so a plain navigation is fine.
  const startCheckout = async (endpoint: string) => {
    setPaying(true);
    setPayError("");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, promoCode: applied?.code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setPayError(data.error || "Couldn't start checkout — please try again.");
    } catch {
      setPayError("Couldn't start checkout — please try again.");
    }
    setPaying(false);
  };

  // Record a manual bank transfer as PENDING and surface its order number, which is
  // what an admin matches the receipt screenshot to.
  const submitManual = async () => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/profile/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, promoCode: applied?.code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.orderNo) {
        setManualOrder({
          orderNo: data.orderNo,
          amount: typeof data.amount === "number" ? data.amount : null,
        });
      } else {
        setSubmitError(data.error || "Couldn't submit — please try again.");
      }
    } catch {
      setSubmitError("Couldn't submit — please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div className="mt-6 space-y-5">
      {/* Promo code — applies to every method (student Premium only; team plans, which
          satway doesn't sell, would hide this box via allowPromo). */}
      {allowPromo && (
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Tag className="h-4 w-4 text-brand-600" /> Promo code
          </h2>
          {applied ? (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                <Check className="h-4 w-4" /> <b>{applied.code}</b> — {applied.pct}% off applied
              </span>
              <button onClick={clearPromo} className="text-emerald-700 hover:text-emerald-900" aria-label="Remove">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="mt-3 flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyPromo()}
                  placeholder="Enter code"
                  autoComplete="off"
                  spellCheck={false}
                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm uppercase tracking-wide outline-none focus:border-brand-500"
                />
                <button
                  onClick={applyPromo}
                  disabled={checking || !code.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {checking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </button>
              </div>
              {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
            </>
          )}
        </div>
      )}

      {/* Payment method tabs. Dormant providers (Payme, Click — built but awaiting a
          separate satway kassa) show a "Soon" badge and unlock automatically once their
          env lands. */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#EAEAEA] bg-white p-2 sm:grid-cols-4">
        {(
          [
            { id: "payme", label: "Payme", sub: "Uzcard/Humo", icon: PaymeLogo, enabled: paymeEnabled },
            { id: "click", label: "Click", sub: "Uzcard/Humo", icon: ClickLogo, enabled: clickEnabled },
            { id: "visa", label: "Visa / MC", sub: "USD", icon: Globe, enabled: visaEnabled },
            { id: "transfer", label: "Transfer", sub: "UZS · manual", icon: CreditCard, enabled: true },
          ] as const
        ).map((m) => {
          const active = method === m.id;
          const brand = BRAND[m.id as keyof typeof BRAND];
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                if (!m.enabled) return;
                setMethod(m.id);
                setPayError(""); // a stale error from another provider misleads
              }}
              disabled={!m.enabled}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-sm font-semibold transition-colors ${
                active
                  ? `${brand ? brand.tab : "bg-slate-900"} text-white`
                  : m.enabled
                    ? "text-slate-600 hover:bg-slate-50"
                    : "cursor-not-allowed text-slate-400"
              }`}
            >
              {/* Fixed height so a wordmark tab and a text tab set the same row height —
                  otherwise Payme's taller mark makes its cell dominate. */}
              <span className="flex h-[26px] items-center justify-center gap-1.5 whitespace-nowrap">
                {m.id === "payme" ? (
                  // The Payme logo IS the word "Payme" — printing the label beside it
                  // would just say it twice.
                  <PaymeLogo className="h-[24px] w-auto" />
                ) : (
                  <>
                    <m.icon className={`h-4 w-4 shrink-0 ${brand && !active ? brand.ink : ""}`} />
                    {m.label}
                  </>
                )}
              </span>
              {m.enabled ? (
                <span
                  className={`text-[11px] font-normal ${
                    active ? (brand ? brand.sub : "text-slate-300") : "text-slate-400"
                  }`}
                >
                  {m.sub}
                </span>
              ) : (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </div>

      {paymeEnabled && method === "payme" && (
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <PaymeLogo className="h-7 w-auto" /> <span className="sr-only">Pay with Payme</span>
          </h2>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span className="text-slate-500">Amount</span>
            <span className="text-right">
              {applied && <span className="mr-2 text-slate-400 line-through">{fmtUZS(amount)}</span>}
              <b className="text-slate-900">{fmtUZS(finalAmount)} UZS</b>
              <span className="text-slate-500"> · {planLabel}</span>
            </span>
          </div>

          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2">
              <Zap className="h-4 w-4 shrink-0 text-amber-500" /> Premium activates automatically, within seconds
            </li>
            <li className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 shrink-0 text-slate-400" /> Pay with any Uzcard/Humo card or from your Payme
              wallet — no registration needed
            </li>
          </ul>

          <button
            onClick={() => startCheckout("/api/payment/payme")}
            disabled={paying}
            className="mt-4 flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#00A3A3] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#008C8C] disabled:opacity-60"
          >
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <PaymeLogo className="h-6 w-auto" mono />}
            {paying ? "Opening Payme…" : `Pay ${fmtUZS(finalAmount)} UZS`}
          </button>
          {payError && <p className="mt-2 text-xs text-red-600">{payError}</p>}
        </div>
      )}

      {clickEnabled && method === "click" && (
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <ClickLogo className="h-4 w-4 text-[#0072FF]" /> Pay with Click
          </h2>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <span className="text-slate-500">Amount</span>
            <span className="text-right">
              {applied && <span className="mr-2 text-slate-400 line-through">{fmtUZS(amount)}</span>}
              <b className="text-slate-900">{fmtUZS(finalAmount)} UZS</b>
              <span className="text-slate-500"> · {planLabel}</span>
            </span>
          </div>

          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2">
              <Zap className="h-4 w-4 shrink-0 text-amber-500" /> Premium activates automatically, within seconds
            </li>
            <li className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 shrink-0 text-slate-400" /> Pay with any Uzcard/Humo card or via the Click app
              — no registration needed
            </li>
          </ul>

          <button
            onClick={() => startCheckout("/api/payment/click")}
            disabled={paying}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0072FF] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#0060d6] disabled:opacity-60"
          >
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClickLogo className="h-5 w-5" />}
            {paying ? "Opening Click…" : `Pay ${fmtUZS(finalAmount)} UZS with Click`}
          </button>
          {payError && <p className="mt-2 text-xs text-red-600">{payError}</p>}
        </div>
      )}

      {visaEnabled && method === "visa" && (
        <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <Globe className="h-4 w-4 text-brand-600" /> Pay with Visa / Mastercard
          </h2>

          <div className="mt-3 space-y-2 rounded-xl bg-slate-50 px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">{planLabel}</span>
              <span className="text-right">
                {applied && <span className="mr-2 text-slate-400 line-through">{fmtUSD(amountUsd)}</span>}
                <b className="text-slate-900">{fmtUSD(finalUsd)}</b>
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-500">
              <span>Card processing fee</span>
              <span>{fmtUSD(CARD_FEE_USD_CENTS)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2">
              <span className="font-semibold text-slate-700">Total</span>
              <b className="text-slate-900">{fmtUSD(finalUsd + CARD_FEE_USD_CENTS)}</b>
            </div>
          </div>

          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li className="flex items-center gap-2">
              <Zap className="h-4 w-4 shrink-0 text-amber-500" /> Premium activates automatically, within seconds
            </li>
            <li className="flex items-center gap-2">
              <Lock className="h-4 w-4 shrink-0 text-slate-400" /> Secure checkout by Polar — card details never touch our
              servers
            </li>
          </ul>

          <button
            onClick={() => startCheckout("/api/payment/polar")}
            disabled={paying}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            {paying ? "Opening secure checkout…" : `Pay ${fmtUSD(finalUsd + CARD_FEE_USD_CENTS)} now`}
          </button>
          {payError && <p className="mt-2 text-xs text-red-600">{payError}</p>}
        </div>
      )}

      {method === "transfer" && (
        <>
          {/* Card */}
          <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <CreditCard className="h-4 w-4 text-brand-600" /> Transfer to this card
            </h2>
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-slate-50 px-4 py-3">
              <span className="font-mono text-lg font-bold tracking-wider text-slate-900">{groupCard(card)}</span>
              <button
                onClick={copyCard}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#EAEAEA] bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </>
                )}
              </button>
            </div>
            <div className="mt-3 flex items-center justify-between text-sm">
              <span className="text-slate-500">Card holder</span>
              <span className="font-medium text-slate-800">{holder}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-slate-500">Amount</span>
              <span className="text-right">
                {applied && <span className="mr-2 text-slate-400 line-through">{fmtUZS(amount)}</span>}
                <b className="text-slate-900">{fmtUZS(finalAmount)} UZS</b>
                <span className="text-slate-500"> · {planLabel}</span>
              </span>
            </div>
          </div>

          {/* Steps + submit + Telegram. Manual transfer is the one flow with a human in
              the loop: it records a PENDING order the admin matches to the receipt. */}
          <div className="rounded-2xl border border-[#EAEAEA] bg-white p-5">
            {manualOrder ? (
              <div className="text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check className="h-6 w-6" />
                </div>
                <h2 className="mt-3 text-base font-bold text-slate-900">Order created</h2>
                <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Your order number</p>
                  <p className="mt-0.5 font-mono text-xl font-bold text-slate-900">{manualOrder.orderNo}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {planLabel} — <b className="text-slate-700">{fmtUZS(manualOrder.amount ?? finalAmount)} UZS</b>
                  </p>
                </div>
                {manualOrder.amount != null && manualOrder.amount !== finalAmount && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-4 py-2 text-xs text-amber-700">
                    The final price for this order is {fmtUZS(manualOrder.amount)} UZS — please make sure you transfer
                    exactly this amount.
                  </p>
                )}
                <p className="mt-3 text-sm text-slate-600">
                  Send this number with your payment receipt so we can find your transfer and activate Premium.
                </p>
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  <Send className="h-4 w-4" /> Send receipt on Telegram
                </a>
                <button
                  onClick={() => router.push("/dashboard")}
                  className="mt-2 w-full rounded-xl border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Go to dashboard
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-slate-900">What to do next</h2>
                <ol className="mt-3 space-y-2.5">
                  {[
                    `Transfer ${fmtUZS(finalAmount)} UZS to the card above.`,
                    'Click "I\'ve paid" to get your order number.',
                    "Send the receipt screenshot and your order number to us on Telegram.",
                  ].map((t, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                        {i + 1}
                      </span>
                      {t}
                    </li>
                  ))}
                </ol>

                <button
                  onClick={submitManual}
                  disabled={submitting}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {submitting ? "Submitting…" : "I've paid"}
                </button>
                {submitError && <p className="mt-2 text-xs text-red-600">{submitError}</p>}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
