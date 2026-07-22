"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Clock } from "lucide-react";

type Phase = "waiting" | "active" | "slow";

/**
 * Poll until the Click webhook's Premium grant becomes visible.
 *
 * The Complete callback usually lands before the student does, but "usually" is not a
 * UX: if this page declared success unconditionally, the one student whose webhook is
 * still in flight would see "you have Premium", open a test, and hit the paywall.
 */
export default function SuccessClient() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [until, setUntil] = useState<string | null>(null);
  const tries = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const check = async () => {
      try {
        const res = await fetch("/api/profile", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          const u = data.user;
          const active =
            u?.plan === "PREMIUM" &&
            u?.premiumUntil &&
            new Date(u.premiumUntil).getTime() > Date.now();
          if (active && !cancelled) {
            setUntil(u.premiumUntil);
            setPhase("active");
            return;
          }
        }
      } catch {
        /* transient — keep polling */
      }
      if (cancelled) return;
      tries.current += 1;
      // ~90 seconds of patience, then stop implying it is about to happen. A webhook
      // that late usually means the payment did not go through.
      if (tries.current >= 30) {
        setPhase("slow");
        return;
      }
      timer = setTimeout(check, 3000);
    };

    void check();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-5">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        {phase === "active" ? (
          <>
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">Premium activated!</h1>
            <p className="mt-2 text-sm text-slate-600">
              Payment received. Premium is active until{" "}
              {until ? new Date(until).toLocaleDateString("en-GB") : ""} —
              all tests, full mocks and the AI tutor are unlocked.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Go to tests
            </Link>
          </>
        ) : phase === "waiting" ? (
          <>
            <Loader2 className="mx-auto h-14 w-14 animate-spin text-brand-600" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">Verifying payment…</h1>
            <p className="mt-2 text-sm text-slate-600">
              Premium activates automatically once Click confirms — usually within a few seconds.
              Please don&apos;t close this page.
            </p>
          </>
        ) : (
          <>
            <Clock className="mx-auto h-14 w-14 text-amber-500" />
            <h1 className="mt-4 text-xl font-bold text-slate-900">Confirmation hasn&apos;t arrived yet</h1>
            <p className="mt-2 text-sm text-slate-600">
              If the payment went through, Premium will activate within a few minutes. If you were
              charged but don&apos;t see Premium, message support with your order number and
              we&apos;ll sort it out right away.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link
                href="/dashboard"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Dashboard
              </Link>
              <Link
                href="/support"
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Support
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
