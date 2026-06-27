"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, ClipboardList, LineChart, BookText, Shield, User, Sparkles, Gift, Crown, LifeBuoy, Trophy, Menu, X } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: typeof Home;
  match?: (path: string) => boolean;
  soon?: boolean;
}

export default function Sidebar({
  name,
  role,
  plan,
}: {
  name?: string | null;
  role?: string;
  plan?: string;
}) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  // Close the mobile drawer on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const [supportUnread, setSupportUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/support/unread")
        .then((r) => r.json())
        .then((d) => {
          if (alive) setSupportUnread(d.count ?? 0);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pathname]);

  const nav: NavItem[] = [
    { label: "Home", href: "/home", icon: Home, match: (p) => p === "/home" },
    {
      label: "Tests",
      href: "/dashboard",
      icon: ClipboardList,
      match: (p) => p === "/dashboard" || p.startsWith("/test"),
    },
    {
      label: "Results",
      href: "/progress",
      icon: LineChart,
      match: (p) => p.startsWith("/progress"),
    },
    {
      label: "Leaderboard",
      href: "/leaderboard",
      icon: Trophy,
      match: (p) => p.startsWith("/leaderboard"),
    },
    {
      label: "Invite",
      href: "/referral",
      icon: Gift,
      match: (p) => p.startsWith("/referral"),
    },
    {
      label: "Vocabulary",
      href: "/vocabulary",
      icon: BookText,
      match: (p) => p.startsWith("/vocabulary"),
    },
  ];

  return (
    <>
      {/* Mobile menu trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="fixed left-2 top-2 z-40 grid h-10 w-10 place-items-center rounded-lg border border-[#EAEAEA] bg-white/90 text-slate-700 shadow-sm backdrop-blur md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-[#EAEAEA] bg-[#FFFDFB] px-4 py-6 transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Close menu"
        className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
      >
        <X className="h-5 w-5" />
      </button>
      <Link href="/dashboard" className="flex flex-col px-2">
        <span className="flex items-center text-xl font-extrabold tracking-tight text-slate-900">
          SAT
          <span className="ml-0.5 rounded-md bg-brand-600 px-1.5 text-white">way</span>
        </span>
        <span className="mt-1 text-[11px] font-semibold tracking-[0.2em] text-slate-400">
          FREE SAT PREP
        </span>
      </Link>

      <nav className="mt-10 flex flex-col gap-1.5">
        {nav.map((item) => {
          const Icon = item.icon;
          if (item.soon) {
            return (
              <span
                key={item.label}
                title="Coming soon"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-300 cursor-not-allowed"
              >
                <Icon className="h-5 w-5" />
                {item.label}
                <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-400">
                  COMING SOON
                </span>
              </span>
            );
          }
          const active = item.match?.(pathname);
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border border-brand-600/30 bg-brand-50 text-brand-600"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        {role === "ADMIN" && (
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
          >
            <Shield className="h-5 w-5" />
            Admin
          </Link>
        )}
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <Link
          href="/support"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            pathname.startsWith("/support")
              ? "border border-brand-600/30 bg-brand-50 text-brand-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <LifeBuoy className="h-5 w-5" />
          Support
          {supportUnread > 0 && (
            <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
              {supportUnread}
            </span>
          )}
        </Link>
        <Link
          href="/profile"
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            pathname.startsWith("/profile")
              ? "border border-brand-600/30 bg-brand-50 text-brand-600"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <User className="h-5 w-5" />
          <span className="truncate">{name ?? "Profile"}</span>
        </Link>
        {plan === "PREMIUM" ? (
          <Link
            href="/upgrade"
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <Crown className="h-4 w-4" />
            Premium
          </Link>
        ) : (
          <Link
            href="/upgrade"
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            <Sparkles className="h-4 w-4" />
            Get Premium
          </Link>
        )}
      </div>
    </aside>
    </>
  );
}
