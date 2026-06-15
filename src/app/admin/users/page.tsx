import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";
import { Shield, Mail, Calendar } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      plan: true,
      createdAt: true,
      premiumUntil: true,
      _count: { select: { attempts: true } },
    },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader name={user.name} role={user.role} />
      <div className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">{users.length} registered user{users.length !== 1 ? "s" : ""}</p>

        <div className="mt-6 overflow-hidden rounded-2xl border border-[#EAEAEA] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#EAEAEA] bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Plan</th>
                <th className="px-6 py-3">Attempts</th>
                <th className="px-6 py-3">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EAEAEA]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Mail className="h-3.5 w-3.5" />
                      {u.email}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {u.role === "ADMIN" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                        <Shield className="h-3 w-3" /> Admin
                      </span>
                    ) : (
                      <span className="text-slate-600">Student</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {u.plan === "PREMIUM" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        Premium
                        {u.premiumUntil && new Date(u.premiumUntil) > new Date() ? " (active)" : " (expired)"}
                      </span>
                    ) : (
                      <span className="text-slate-400">Free</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{u._count.attempts}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Calendar className="h-3.5 w-3.5" />
                      {u.createdAt.toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
