import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { notifyAdminPayment } from "@/lib/telegram";
import { parseJson } from "@/lib/validation";
import { jsonError, withErrorHandling } from "@/lib/apiError";
import { resolveCheckoutIntent, formatOrderNo } from "@/lib/checkout";

const bodySchema = z.object({
  planId: z.enum(["1m", "2m", "3m"]),
  note: z.string().trim().max(500).optional(),
  // The CODE, never a price. See src/lib/checkout.ts — the amount is derived here.
  promoCode: z.string().trim().max(40).optional(),
});

// Records a Premium payment as PENDING. Does NOT grant Premium — an admin
// must verify the transfer and approve it (see /api/admin/payments/[id]).
export const POST = withErrorHandling(async (req: NextRequest) => {
  const sessionUser = await currentUser();
  if (!sessionUser) return jsonError("Authorization required", 401);

  const { planId, note, promoCode } = await parseJson(req, bodySchema);

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { name: true, email: true },
  });
  if (!user) return jsonError("User not found", 404);

  // Everything about the price is decided here, from the plan id and the code. The
  // client never sends an amount. An unusable promo quietly resolves to list price —
  // /api/promo/validate is what tells the student their code is bad, while they can
  // still do something about it. Resolve BEFORE the dedup, so the reused order and the
  // created order describe the same intent.
  const resolved = await resolveCheckoutIntent({
    planId,
    buyerId: sessionUser.id,
    promoCode,
  });
  if (!resolved.ok) return jsonError("Unknown plan", 400);
  const { plan, amount, baseAmount, discountPercent, promo } = resolved.intent;

  // Reuse an identical abandoned manual order instead of stacking a new one — but ONLY
  // one for the SAME plan and amount, and never a hosted-checkout (Polar/Click/Payme)
  // PENDING row. The order number handed back is what an admin reconciles the receipt
  // against, so it must describe the transfer shown on screen, not some other pending
  // intent. Mirrors the { provider, planLabel, amount } dedup the click/payme routes use.
  const existingPending = await prisma.payment.findFirst({
    where: {
      userId: sessionUser.id,
      provider: "manual",
      status: "PENDING",
      planLabel: plan.id,
      amount,
    },
    select: { orderNo: true },
  });
  if (existingPending) {
    return Response.json({
      ok: true,
      status: "PENDING",
      pending: true,
      orderNo: formatOrderNo(existingPending.orderNo),
      amount,
      discountPercent,
    });
  }

  const payment = await prisma.payment.create({
    data: {
      userId: sessionUser.id,
      planLabel: plan.id,
      months: plan.months,
      amount,
      baseAmount,
      discountPercent,
      // Snapshot, not a join — see the Payment model. The code can be edited or
      // reassigned tomorrow; what this sale earned whom is settled now.
      promoCode: promo?.code ?? null,
      promoOwnerId: promo?.ownerId ?? null,
      commissionPct: promo?.commissionPct ?? 0,
      provider: "manual",
      note,
      status: "PENDING",
    },
    select: { id: true, orderNo: true },
  });

  // Best-effort: count the redemption. Deliberately NOT atomic with the create — this is
  // a PENDING request, most of which are never approved, and a code that locks a slot on
  // an intent nobody honours would exhaust itself on ghosts.
  if (promo) {
    await prisma.promoCode
      .update({ where: { code: promo.code }, data: { usedCount: { increment: 1 } } })
      .catch(() => {});
  }

  notifyAdminPayment(user.name, plan.label, amount);

  return Response.json({
    ok: true,
    status: "PENDING",
    orderNo: formatOrderNo(payment.orderNo),
    amount,
    discountPercent,
  });
});
