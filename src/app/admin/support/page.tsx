import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";
import AdminSupportClient from "./AdminSupportClient";

export const dynamic = "force-dynamic";

export default async function AdminSupportPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/dashboard");

  const supportUsers = await prisma.user.findMany({
    where: {
      supportMessages: { some: {} },
    },
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { supportMessages: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader name={user.name} role={user.role} />
      <AdminSupportClient
        adminId={user.id}
        users={JSON.parse(JSON.stringify(supportUsers))}
      />
    </div>
  );
}
