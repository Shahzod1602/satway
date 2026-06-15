"use client";

import Link from "next/link";

export default function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-5 bg-[#FBFAF7]">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="drift absolute -left-32 top-[-10%] h-[36rem] w-[36rem] rounded-full bg-brand-500/15 blur-[120px]" />
        <div
          className="drift absolute right-[-10%] top-[8%] h-[30rem] w-[30rem] rounded-full bg-accent-500/15 blur-[120px]"
          style={{ animationDelay: "-6s" }}
        />
      </div>
      <Link href="/" className="mb-8 flex items-center text-xl font-extrabold tracking-tight text-slate-900">
        SAT
        <span className="ml-0.5 rounded-md bg-brand-600 px-1.5 text-white">way</span>
      </Link>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {children}
      </div>
    </div>
  );
}
