"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOut, LayoutDashboard, Shield } from "lucide-react";

export default function AppHeader({
  name,
  role,
}: {
  name?: string | null;
  role?: string;
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-5 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg">
          <span className="flex items-center text-xl font-extrabold tracking-tight text-slate-900">
            SAT
            <span className="ml-0.5 rounded-md bg-brand-600 px-1.5 text-white">way</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <LayoutDashboard className="w-4 h-4" /> Home
          </Link>
          {role === "ADMIN" && (
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Shield className="w-4 h-4" /> Admin
            </Link>
          )}
          <span className="hidden sm:block ml-2 text-slate-400">&middot;</span>
          <span className="hidden sm:block px-2 text-slate-600">{name}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </nav>
      </div>
    </header>
  );
}
