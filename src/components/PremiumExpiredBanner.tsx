import Link from "next/link";
import { Crown } from "lucide-react";
import { PREMIUM_PLANS } from "@/lib/plans";

// Shown on the dashboard / home when a user's Premium (or welcome trial) has
// lapsed — the in-app half of the win-back. Plain component (no hooks) so it
// works in both server and client trees.
export default function PremiumExpiredBanner({ className = "" }: { className?: string }) {
  const off = Math.max(...PREMIUM_PLANS.map((p) => p.discount));
  return (
    <Link
      href="/upgrade"
      className={`flex items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 via-amber-50 to-white px-5 py-4 transition-colors hover:border-amber-400 ${className}`}
    >
      <span className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-amber-100 text-amber-600">
          <Crown className="h-5 w-5" />
        </span>
        <span className="text-sm text-slate-700">
          <strong className="font-semibold text-slate-900">Your Premium has ended.</strong>{" "}
          Renew to unlock all SAT practice tests and full adaptive mock exams — up to {off}% off.
        </span>
      </span>
      <span className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white">
        Renew Premium
      </span>
    </Link>
  );
}
