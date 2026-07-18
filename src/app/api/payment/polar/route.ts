import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { parseJson } from "@/lib/validation";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { createPolarCheckout, polarConfigured } from "@/lib/polar";
import { resolveCheckoutIntent } from "@/lib/checkout";
import { CARD_FEE_USD_CENTS } from "@/lib/plans";
import { appUrl } from "@/lib/winback";

const bodySchema = z.object({
  planId: z.enum(["1m", "3m", "6m"]),
  promoCode: z.string().trim().max(40).optional(),
});

// POST { planId, promoCode? } → { url } — a Polar hosted-checkout URL the client
// redirects to. The USD amount is computed HERE (plan + validated promo) and locked
// into the checkout as a fixed ad-hoc price, so the client can never choose its own.
export const POST = withErrorHandling(async (req: NextRequest) => {
  const user = await currentUser();
  if (!user) return jsonError("Sign in to continue", 401);
  if (!polarConfigured()) {
    return jsonError("Card payments are not available right now", 503);
  }
  const rl = rateLimit(`polar-checkout:${user.id}`, 10, 60 * 1000);
  if (!rl.ok) return tooManyRequests(rl.retryAfterSec);

  const { planId, promoCode } = await parseJson(req, bodySchema);

  const resolved = await resolveCheckoutIntent({ planId, buyerId: user.id, promoCode });
  if (!resolved.ok) return jsonError("Unknown plan", 400);
  const { plan, amount, baseAmount, discountPercent, promo } = resolved.intent;

  // The buyer pays the (promo-discounted) plan price plus a flat card surcharge that
  // passes Polar's fixed per-transaction fee on to them. The fee also guarantees the
  // charge clears Polar's $0.50 minimum, so a 100%-off promo lands at $0.50 rather
  // than being rejected.
  const discountedUsd = Math.round((plan.totalUsd * (100 - discountPercent)) / 100);
  const amountUsd = discountedUsd + CARD_FEE_USD_CENTS;
  if (amountUsd < 50) {
    // Unreachable while the surcharge is ≥ Polar's $0.50 floor, but guards the day
    // the fee changes: card processors can't charge below $0.50.
    return jsonError("This discount is too large for card checkout — use another payment option", 400);
  }

  // Unlike Click, no pending-row reuse: every click mints a fresh checkout session,
  // and a session that never turns into a Polar checkout is deleted below.
  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      provider: "polar",
      planLabel: plan.id,
      months: plan.months,
      // `amount` stays the UZS equivalent — analytics revenue and promo commission
      // read it and must stay one-currency across providers. What the card is
      // actually charged lives in `amountUsd` (cents), which the webhook enforces.
      amount,
      baseAmount,
      amountUsd,
      discountPercent,
      promoCode: promo?.code ?? null,
      promoOwnerId: promo?.ownerId ?? null,
      commissionPct: promo?.commissionPct ?? 0,
      status: "PENDING",
    },
    select: { id: true, orderNo: true },
  });

  // Telegram-only accounts carry a synthetic address — don't prefill it into the
  // checkout (the receipt would bounce).
  const email = user.email && !user.email.endsWith("@telegram.satway.online") ? user.email : null;
  const ip = clientIp(req);

  const checkout = await createPolarCheckout({
    planId: plan.id,
    amountUsdCents: amountUsd,
    email,
    clientIp: ip !== "unknown" ? ip : null,
    successUrl: appUrl("/upgrade/success"),
    custom: { payment_id: payment.id, user_id: user.id },
  });

  if (!checkout.ok) {
    // The checkout never existed — drop the PENDING row so it can't confuse the
    // admin payments list.
    await prisma.payment.delete({ where: { id: payment.id } }).catch(() => {});
    console.error(`[polar] checkout failed: user=${user.id} plan=${plan.id} error=${checkout.error}`);
    return jsonError("Couldn't start card checkout — please try again", 502);
  }

  await prisma.payment.update({
    where: { id: payment.id },
    data: { polarCheckoutId: checkout.checkoutId },
  });

  console.log(
    `[polar] checkout created: user=${user.id} order=${payment.orderNo} plan=${plan.id} usd=${amountUsd}${promo ? ` promo=${promo.code}` : ""}`,
  );
  return Response.json({ url: checkout.url });
});
