import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { parseJson } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { buildPaymeCheckoutUrl, paymeConfigured } from "@/lib/payme";
import { resolveCheckoutIntent } from "@/lib/checkout";
import { appUrl } from "@/lib/winback";

const bodySchema = z.object({
  planId: z.enum(["1m", "2m", "3m"]),
  promoCode: z.string().trim().max(40).optional(),
});

// POST { planId, promoCode? } → { url } — the checkout.paycom.uz page for a fresh
// PENDING Payment row. The UZS amount is computed HERE; Payme's CheckPerform/Create
// callbacks re-check it against the row, so the client can never pay a self-chosen
// amount.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await currentUser();
  if (!user) return jsonError("Sign in to continue", 401);
  if (!paymeConfigured()) {
    return jsonError("Payme payments are not available right now", 503);
  }
  const rl = rateLimit(`payme-checkout:${user.id}`, 10, 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { planId, promoCode } = await parseJson(req, bodySchema);

  const resolved = await resolveCheckoutIntent({ planId, buyerId: user.id, promoCode });
  if (!resolved.ok) return jsonError("Unknown plan", 400);
  const { plan, amount, baseAmount, discountPercent, promo } = resolved.intent;

  if (amount < 1000) {
    return jsonError("This discount is too large for Payme checkout — contact us on Telegram", 400);
  }

  // Reuse an identical abandoned checkout, but ONLY one no Payme transaction has
  // attached to yet: once paymeTransId is set, that order belongs to Payme's state
  // machine and a new attempt needs a fresh order (CreateTransaction on a held order
  // answers -31051 by design).
  const existing = await prisma.payment.findFirst({
    where: {
      userId: user.id,
      provider: "payme",
      status: "PENDING",
      planLabel: plan.id,
      amount,
      paymeTransId: null,
    },
    select: { orderNo: true },
  });

  const orderNo =
    existing?.orderNo ??
    (
      await prisma.payment.create({
        data: {
          userId: user.id,
          provider: "payme",
          planLabel: plan.id,
          months: plan.months,
          amount,
          baseAmount,
          discountPercent,
          promoCode: promo?.code ?? null,
          promoOwnerId: promo?.ownerId ?? null,
          commissionPct: promo?.commissionPct ?? 0,
          status: "PENDING",
        },
        select: { orderNo: true },
      })
    ).orderNo;

  const url = buildPaymeCheckoutUrl({
    amountUzs: amount,
    orderNo,
    returnUrl: `${appUrl()}/upgrade/success`,
  });

  console.log(
    `[payme] checkout created: user=${user.id} order=${orderNo} plan=${plan.id} amount=${amount}${promo ? ` promo=${promo.code}` : ""}`,
  );
  return Response.json({ url });
});
