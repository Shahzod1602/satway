/**
 * Analytics loads ~25–30 raw SQL queries in parallel (8 board functions, each fanning out
 * to 3–5 more). On a cold DB that is a multi-second render, and the default fallback is a
 * blank screen — which reads as "broken". A skeleton keeps the layout stable and signals
 * "working on it" instead.
 */
export default function Loading() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-16 animate-pulse border-b border-slate-200 bg-white" />
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="h-7 w-32 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-80 animate-pulse rounded bg-slate-100" />

        <div className="mt-8 h-6 w-56 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>

        <div className="mt-8 h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ))}
        </div>

        <div className="mt-8 h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />
        <div className="mt-8 h-48 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    </div>
  );
}
