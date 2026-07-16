import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { requireAdmin } from "@/lib/adminGuard";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/components/AppHeader";
import PromoClient from "./PromoClient";

export const dynamic = "force-dynamic";

export default async function AdminPromoPage() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (!(await requireAdmin())) redirect("/dashboard");

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: { owner: { select: { name: true, email: true } } },
  });

  // What each code sold and what its owner is owed — read from the Payment SNAPSHOTS, so
  // editing a code's percentage tomorrow cannot rewrite what was already earned.
  const paid = await prisma.payment.findMany({
    where: { status: "APPROVED", promoCode: { not: null } },
    select: { promoCode: true, amount: true, commissionPct: true },
  });

  const stats = new Map<string, { count: number; revenue: number; commission: number }>();
  for (const p of paid) {
    const k = p.promoCode!;
    const s = stats.get(k) ?? { count: 0, revenue: 0, commission: 0 };
    s.count += 1;
    s.revenue += p.amount;
    s.commission += Math.round(p.amount * (p.commissionPct / 100));
    stats.set(k, s);
  }

  const rows = codes.map((c) => ({
    ...c,
    ownerName: c.owner?.name ?? null,
    ownerEmail: c.owner?.email ?? null,
    soldCount: stats.get(c.code)?.count ?? 0,
    revenue: stats.get(c.code)?.revenue ?? 0,
    commissionOwed: stats.get(c.code)?.commission ?? 0,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader name={user.name} role={user.role} />
      <div className="mx-auto max-w-6xl px-5 py-10">
        <h1 className="text-2xl font-bold text-slate-900">Promo codes</h1>
        <p className="mt-1 text-sm text-slate-600">
          A code with an owner is a distribution channel: give a teacher a code, and this
          page tells you what they sold and what you owe them.
        </p>
        <PromoClient initialCodes={JSON.parse(JSON.stringify(rows))} />
      </div>
    </div>
  );
}
