import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { rateLimit } from "@/lib/rateLimit";
import { parseJson } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { buildClickPayUrl, clickConfigured } from "@/lib/click";
import { resolveCheckoutIntent } from "@/lib/checkout";
import { appUrl } from "@/lib/winback";

const bodySchema = z.object({
  planId: z.enum(["1m", "3m", "6m"]),
  promoCode: z.string().trim().max(40).optional(),
});

// POST { planId, promoCode? } → { url } — the my.click.uz payment page for a fresh
// PENDING Payment row. The UZS amount is computed HERE (plan + validated promo);
// Click's Prepare callback re-checks it against the row, so the client can never pay
// a self-chosen amount.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await currentUser();
  if (!user) return jsonError("Sign in to continue", 401);
  if (!clickConfigured()) {
    return jsonError("Click payments are not available right now", 503);
  }
  const rl = rateLimit(`click-checkout:${user.id}`, 10, 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { planId, promoCode } = await parseJson(req, bodySchema);

  const resolved = await resolveCheckoutIntent({ planId, buyerId: user.id, promoCode });
  if (!resolved.ok) return jsonError("Unknown plan", 400);
  const { plan, amount, baseAmount, discountPercent, promo } = resolved.intent;

  if (amount < 1000) {
    // Click's practical minimum — and a promo that deep shouldn't hit billing anyway.
    return jsonError("This discount is too large for Click checkout — contact us on Telegram", 400);
  }

  // Reuse an identical abandoned checkout instead of minting a new order each time the
  // button is clicked. Same plan and same amount only — a changed promo or plan gets a
  // fresh row, because Prepare validates the amount against the row it finds.
  const existing = await prisma.payment.findFirst({
    where: {
      userId: user.id,
      provider: "click",
      status: "PENDING",
      planLabel: plan.id,
      amount,
    },
    select: { orderNo: true },
  });

  const orderNo =
    existing?.orderNo ??
    (
      await prisma.payment.create({
        data: {
          userId: user.id,
          provider: "click",
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

  const url = buildClickPayUrl({
    amountUzs: amount,
    orderNo,
    returnUrl: `${appUrl()}/upgrade/success`,
  });

  console.log(
    `[click] checkout created: user=${user.id} order=${orderNo} plan=${plan.id} amount=${amount}${promo ? ` promo=${promo.code}` : ""}`,
  );
  return Response.json({ url });
});
