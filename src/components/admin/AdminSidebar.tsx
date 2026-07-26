"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutDashboard,
  LifeBuoy,
  CreditCard,
  Megaphone,
  Ticket,
  ListChecks,
  Sparkles,
  Users,
  Menu,
  X,
} from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: typeof BarChart3;
  match: (path: string) => boolean;
}

/**
 * The admin sections, in nav order.
 *
 * Analytics is FIRST on purpose — it is the one screen the operator opens to take the
 * pulse of the product (retention, funnel, AI spend, suspect questions), so it sits at
 * the top of the list rather than buried under the content tools. The rest mirror the
 * order of the AdminPanel hub cards.
 */
const NAV: NavItem[] = [
  // ── First: the dashboard ──
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    match: (p) => p.startsWith("/admin/analytics"),
  },
  {
    label: "Admin home",
    href: "/admin",
    icon: LayoutDashboard,
    match: (p) => p === "/admin",
  },
  // ── Content ──
  {
    label: "Tests",
    href: "/admin/tests",
    icon: ListChecks,
    match: (p) => p.startsWith("/admin/tests") || p.startsWith("/admin/test"),
  },
  {
    label: "Generate",
    href: "/admin/generate",
    icon: Sparkles,
    match: (p) => p.startsWith("/admin/generate"),
  },
  // ── Operations ──
  {
    label: "Users",
    href: "/admin/users",
    icon: Users,
    match: (p) => p.startsWith("/admin/users"),
  },
  {
    label: "Payments",
    href: "/admin/payments",
    icon: CreditCard,
    match: (p) => p.startsWith("/admin/payments"),
  },
  {
    label: "Promo codes",
    href: "/admin/promo",
    icon: Ticket,
    match: (p) => p.startsWith("/admin/promo"),
  },
  {
    label: "Announcements",
    href: "/admin/broadcast",
    icon: Megaphone,
    match: (p) => p.startsWith("/admin/broadcast"),
  },
  {
    label: "Support",
    href: "/admin/support",
    icon: LifeBuoy,
    match: (p) => p.startsWith("/admin/support"),
  },
];

/**
 * Left navigation for /admin/**. Mirrors the learner Sidebar (src/components/Sidebar.tsx)
 * shape — client component, usePathname for active state, a mobile drawer that closes on
 * navigation — but feeds it the admin nav set and an unread-support badge polled from the
 * existing /api/support/unread endpoint.
 */
export default function AdminSidebar({ supportUnread = 0 }: { supportUnread?: number }) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  // Initial unread-support count comes from the layout's server query; this state is the
  // single source for the badge, kept fresh by the poller below.
  const [unread, setUnread] = useState(supportUnread);

  // Close the mobile drawer on navigation, and poll /api/support/unread for the badge.
  // Both react to pathname, so they share one effect. setState-in-effect is intended:
  // the drawer state is UI, and the unread count is fetched telemetry (not derived).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
    let alive = true;
    const load = () =>
      fetch("/api/support/unread")
        .then((r) => r.json())
        .then((d) => {
          if (alive) setUnread(d.count ?? 0);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 30000);
    // Re-poll immediately when an admin support thread is opened/read elsewhere on the
    // page, so the badge clears the moment messages are marked read instead of up to 30s
    // later.
    const onRead = () => load();
    window.addEventListener("support:read", onRead);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("support:read", onRead);
    };
  }, [pathname]);

  // Sync the server-provided initial count into state when it changes (new server render).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUnread(supportUnread);
  }, [supportUnread]);

  return (
    <>
      {/* Mobile menu trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open admin menu"
        className="fixed left-2 top-2 z-40 grid h-10 w-10 place-items-center rounded-lg border border-slate-200 bg-white/90 text-slate-700 shadow-sm backdrop-blur md:hidden"
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
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-64 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6 transition-transform duration-200 md:sticky md:top-0 md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close admin menu"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 md:hidden"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Logo */}
        <Link href="/admin" className="flex flex-col px-2">
          <span className="flex items-center text-xl font-extrabold tracking-tight text-slate-900">
            SAT
            <span className="ml-0.5 rounded-md bg-brand-600 px-1.5 text-white">way</span>
          </span>
          <span className="mt-1 text-[11px] font-semibold tracking-[0.2em] text-slate-400">
            ADMIN PANEL
          </span>
        </Link>

        {/* Nav */}
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border border-brand-600/30 bg-brand-50 text-brand-600"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
                {item.href === "/admin/support" && unread > 0 && (
                  <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer — back to the app */}
        <div className="mt-auto">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
          >
            <LayoutDashboard className="h-5 w-5" />
            Back to app
          </Link>
        </div>
      </aside>
    </>
  );
}
