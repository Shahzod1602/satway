import { prisma } from "@/lib/prisma";
import AdminPaymentsClient from "./AdminPaymentsClient";
import { formatOrderNo } from "@/lib/checkout";

export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  const payments = await prisma.payment.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      user: { select: { id: true, name: true, email: true, plan: true, premiumUntil: true } },
    },
  });

  const initial = payments.map((p) => ({
    id: p.id,
    // The reference the student was told to quote with their receipt. Without it on this
    // screen, the person approving is matching a Telegram screenshot to a name by eye.
    orderNo: formatOrderNo(p.orderNo),
    planLabel: p.planLabel,
    months: p.months,
    amount: p.amount,
    baseAmount: p.baseAmount,
    discountPercent: p.discountPercent,
    promoCode: p.promoCode,
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

  return <AdminPaymentsClient initial={initial} />;
}
