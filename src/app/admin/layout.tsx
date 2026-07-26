import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";
import AdminSidebar from "@/components/admin/AdminSidebar";

export const dynamic = "force-dynamic";

/**
 * Shared shell for every /admin/** route.
 *
 * Before this layout, each of the 10 admin pages opened with the same three lines
 * (`currentUser()` → login redirect → `requireAdmin()` → dashboard redirect) and the
 * same `<div className="min-h-screen">` + `<AppHeader/>` chrome. Both now live here
 * once, so a page is just its content — and the admin auth check (which re-reads the
 * role from the DB on every request, since the JWT role is baked at login) happens in
 * exactly one place.
 *
 * The sidebar gets an initial unread-support count from the same server query the
 * Support badge used to do per-page; it tops itself up by polling the public endpoint.
 *
 * `<main>` deliberately carries NO max-width: the admin pages disagree on width
 * (broadcast/generate are 4xl, payments is 5xl, the rest 6xl), so each page keeps its
 * own container. The layout owns the chrome, not the page width.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!(await requireAdmin())) redirect("/dashboard");

  const supportUnread = await prisma.supportMessage.count({
    where: { fromAdmin: false, readByAdmin: false },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader name={user.name} role={user.role} />
      <div className="mx-auto flex max-w-7xl">
        <AdminSidebar supportUnread={supportUnread} />
        <main className="min-w-0 flex-1 px-5 py-10">{children}</main>
      </div>
    </div>
  );
}
