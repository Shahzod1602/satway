import { WifiOff } from "lucide-react";

// Served by the service worker when a navigation fails offline.
export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 px-6">
      <div className="max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-500">
          <WifiOff className="h-7 w-7" />
        </div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">You&apos;re offline</h1>
        <p className="mx-auto mt-2 max-w-xs text-sm text-slate-500">
          SATway needs a connection to load tests and save your progress. Reconnect and
          try again — your place is safe.
        </p>
        <a
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          Retry
        </a>
      </div>
    </div>
  );
}
