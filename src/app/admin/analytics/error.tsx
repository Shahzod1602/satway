"use client";

import { useEffect } from "react";

/**
 * Analytics fans out to ~25–30 raw SQL queries against the `analytics_activity` VIEW and
 * the Event ledger. If the view isn't installed, or a connection times out, or a BigInt
 * sneaks through un-Number()'d, the whole page 500s. Without this boundary that becomes a
 * blank white screen with a stack trace; with it the admin gets a clear "the board is
 * down, here is why" and a path back.
 */
export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[analytics] board failed:", error);
  }, [error]);

  // The most common cause by far is the analytics_activity VIEW not existing on a fresh
  // deploy. Detect it and give a targeted message rather than a generic "something broke".
  const viewMissing =
    /analytics_activity/i.test(error.message) || /relation .* does not exist/i.test(error.message);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-5 py-16 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-rose-100 text-rose-600">
          <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Analytics board failed to load</h1>

        {viewMissing ? (
          <p className="mt-2 text-sm text-slate-600">
            The <code className="rounded bg-slate-100 px-1">analytics_activity</code> view is
            missing. Apply the migration under{" "}
            <code className="rounded bg-slate-100 px-1">prisma/migrations/20260716140000_analytics_activity_view</code>{" "}
            (it cannot be modelled in Prisma, so it is raw SQL), then retry.
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            One of the board queries threw. This is usually a transient DB hiccup or a fresh
            deploy where the Event table is not installed yet.
          </p>
        )}

        {error.digest && (
          <p className="mt-3 text-xs text-slate-400">Error digest: {error.digest}</p>
        )}

        <button
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
