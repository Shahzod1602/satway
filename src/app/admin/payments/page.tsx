import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";
import AdminPaymentsClient from "./AdminPaymentsClient";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const isAdmin = await requireAdmin();
  if (!isAdmin) redirect("/dashboard");

  const payments = await prisma.payment.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true, plan: true, premiumUntil: true } },
    },
  });

  const initial = payments.map((p) => ({
    id: p.id,
    planLabel: p.planLabel,
    months: p.months,
    amount: p.amount,
    status: p.status,
    note: p.note,
    createdAt: p.createdAt.toISOString(),
    user: {
      name: p.user.name,
      email: p.user.email,
      plan: p.user.plan,
      premiumUntil: p.user.premiumUntil ? p.user.premiumUntil.toISOString() : null,
    },
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader name={user.name} role={user.role} />
      <AdminPaymentsClient initial={initial} />
    </div>
  );
}
