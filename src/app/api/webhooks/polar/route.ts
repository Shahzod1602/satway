import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPolarSignature, paidEnough } from "@/lib/polar";
import { grantPremiumMonths } from "@/lib/grantPremium";
import { rewardReferrerIfNeeded } from "@/lib/referral";
import { fmtUSD, fmtUZS } from "@/lib/plans";
import { formatOrderNo } from "@/lib/checkout";
import { notifyAdmin } from "@/lib/telegram";
import { emit } from "@/lib/events";

// Polar webhook (created by scripts/_polar-setup.mts; visible in the Polar dashboard):
//   URL:    https://satway.online/api/webhooks/polar
//   Format: Raw
//   Events: order.paid, order.refunded
// Signature: Standard Webhooks (webhook-id / webhook-timestamp / webhook-signature).
// Polar retries failed deliveries up to 10 times and disables an endpoint after 10
// consecutive non-2xx, so non-2xx = "please retry" and every handler must be
// idempotent (the PENDING→APPROVED claim below guarantees that). A 3xx counts as a
// failure too — the URL registered in Polar must be the final one, no redirect.
//
// We grant on `order.paid`, never on `order.created`: Polar sends the latter while
// the order can still be `pending`, i.e. before the money has actually settled.

type PolarOrder = {
  id?: string;
  status?: string; // "paid" | "refunded" | "partially_refunded" | "pending" | ...
  currency?: string; // "usd"
  // All amounts are integer cents.
  // after discounts and EXCLUDING tax — under Polar's location-based tax behaviour this
  // sits BELOW the price we locked for any buyer whose country prices tax-inclusive.
  net_amount?: number;
  discount_amount?: number;
  total_amount?: number; // what the card was charged (net + tax) — the price the buyer agreed to
  refunded_amount?: number;
  metadata?: Record<string, unknown>; // copied verbatim from the checkout we created
  customer?: { email?: string; name?: string };
};

type PolarWebhookPayload = { type?: string; data?: PolarOrder };

/** Polar's order id as stored in Payment.providerRef. */
const polarRef = (orderId: string) => `polar:${orderId}`;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (!verifyPolarSignature(raw, req.headers)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: PolarWebhookPayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.type === "order.paid") return handleOrderPaid(payload);
  if (payload.type === "order.refunded") return handleOrderRefunded(payload);
  return NextResponse.json({ ok: true }); // event we don't handle — ack it
}

async function handleOrderPaid(payload: PolarWebhookPayload) {
  const order = payload.data ?? {};
  const orderId = String(order.id ?? "");
  const meta = order.metadata ?? {};
  const paymentId = typeof meta.payment_id === "string" ? meta.payment_id : "";
  const buyer = order.customer?.email ?? "unknown buyer";

  console.log(`[polar] order.paid: order=${orderId} payment=${paymentId} net=${order.net_amount}`);

  if (!paymentId) {
    // Order didn't come from our checkout flow (e.g. created in the Polar dashboard)
    // — nothing to match, let the admin sort it out.
    await notifyAdmin(
      `⚠️ Polar order ${orderId} (${buyer}) has no payment reference — if it's a real SATway purchase, activate Premium manually in /admin/users.`,
    );
    return NextResponse.json({ ok: true });
  }

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      user: { select: { name: true, email: true } },
      promoOwner: { select: { name: true } },
    },
  });

  if (!payment || payment.provider !== "polar") {
    // Paid order pointing at a payment row we don't have (e.g. a sandbox checkout
    // replayed at prod) — never silent, money changed hands.
    await notifyAdmin(
      `⚠️ Polar order ${orderId} (${buyer}) is paid but references unknown payment ${paymentId} — check the Polar dashboard and refund or activate manually.`,
    );
    return NextResponse.json({ ok: true });
  }

  const orderRef = formatOrderNo(payment.orderNo);

  if (payment.status !== "PENDING") {
    // Same orderId = Polar redelivering the webhook — benign, stay silent.
    // A DIFFERENT orderId = the (multi-use) checkout link was paid AGAIN: the buyer
    // was double-charged and must be refunded.
    if (payment.providerRef && payment.providerRef !== polarRef(orderId)) {
      emit("error", { surface: "upgrade", key: "polar_double_charge", userId: payment.userId, ok: false });
      await notifyAdmin(
        `⚠️ Possible DOUBLE CHARGE\nPolar order ${orderId} paid the already-completed checkout ${orderRef} of ${payment.user.name} (${payment.user.email}), ${fmtUSD(payment.amountUsd ?? 0)}.\nRefund this order in the Polar dashboard.`,
      );
    } else {
      console.log(`[polar] duplicate delivery: order=${orderId} payment=${paymentId}`);
    }
    return NextResponse.json({ ok: true });
  }

  // Enforce the paid amount BEFORE granting — against the CHARGE, not the slice of it
  // left after Polar's merchant-of-record tax. See paidEnough() for why net_amount is
  // the wrong field and what it cost the sister platform.
  const { ok: enough, paid, currency } = paidEnough(order, payment.amountUsd);
  // A row with no expected USD price is one paidEnough already rejects; naming it again
  // here is what narrows amountUsd to non-null for the rest of the handler.
  if (!enough || payment.amountUsd === null) {
    emit("error", { surface: "upgrade", key: "polar_underpaid", userId: payment.userId, ok: false });
    await notifyAdmin(
      `⚠️ Underpaid Polar order ${orderRef}\n${payment.user.name} (${payment.user.email}) paid ${
        paid === null ? "an unknown amount" : `${fmtUSD(paid)} ${currency.toUpperCase()}`
      } but ${fmtUSD(payment.amountUsd ?? 0)} USD was expected.\nPremium NOT granted automatically — check the order in Polar, then grant in /admin/users or refund.`,
    );
    return NextResponse.json({ ok: true }); // leave the row PENDING for review
  }

  // Claim + grant atomically. The PENDING→APPROVED claim makes concurrent deliveries
  // no-ops; a thrown error rolls everything back and our non-2xx tells Polar to
  // redeliver.
  const granted = await prisma.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: { status: "APPROVED", providerRef: polarRef(orderId), paidAt: new Date() },
    });
    if (claim.count === 0) return null; // a concurrent delivery won the race
    return { user: await grantPremiumMonths(tx, payment.userId, payment.months) };
  });

  if (!granted) {
    console.log(`[polar] duplicate delivery lost the race: order=${orderId}`);
    return NextResponse.json({ ok: true });
  }
  if (!granted.user) {
    // Paid but the account was deleted in the meantime — needs a human.
    await notifyAdmin(
      `⚠️ Polar order ${orderRef} paid, but the user of payment ${paymentId} no longer exists. Refund it in the Polar dashboard.`,
    );
    return NextResponse.json({ ok: true });
  }

  // Post-commit extras must never fail the webhook after the money-critical work
  // committed — Polar would retry into the duplicate path and they'd be lost for good.
  try {
    await rewardReferrerIfNeeded(payment.userId); // idempotent (atomic claim inside)
  } catch (e) {
    console.error("[polar] referral reward failed:", (e as Error).message);
  }

  const commission =
    payment.promoOwnerId && payment.commissionPct > 0
      ? Math.round(payment.amount * (payment.commissionPct / 100))
      : 0;
  await notifyAdmin(
    [
      `💳 Polar payment (Visa/USD) · order ${orderRef} (SATway)`,
      `${granted.user.name} (${granted.user.email})`,
      `Plan: ${payment.planLabel} — ${fmtUSD(payment.amountUsd)} (≈${fmtUZS(payment.amount)} UZS)`,
      payment.promoCode ? `Promo: ${payment.promoCode} (−${payment.discountPercent}%)` : null,
      commission > 0 && payment.promoOwner
        ? `Owner: ${payment.promoOwner.name} — share ${fmtUZS(commission)} UZS (${payment.commissionPct}%)`
        : null,
      `Premium: until ${granted.user.premiumUntil.toISOString().slice(0, 10)}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return NextResponse.json({ ok: true });
}

async function handleOrderRefunded(payload: PolarWebhookPayload) {
  const order = payload.data ?? {};
  const orderId = String(order.id ?? "");

  const payment = await prisma.payment.findFirst({
    where: { provider: "polar", providerRef: polarRef(orderId) },
    include: { user: { select: { name: true, email: true } } },
  });
  const orderRef = payment ? formatOrderNo(payment.orderNo) : orderId;

  // order.refunded fires for PARTIAL refunds too (status stays "partially_refunded").
  // Only a FULL refund flips our row — otherwise a small goodwill refund would erase a
  // whole sale from the ledger, and a later real full refund would no-op.
  //
  // Note Polar can refund on its OWN initiative (it pre-empts chargebacks within 60
  // days), so this can fire without anyone here having asked for it.
  if (order.status !== "refunded") {
    if (payment) {
      await notifyAdmin(
        `↩️ Partial Polar refund\nOrder ${orderRef} — ${payment.user.name} (${payment.user.email}): ${fmtUSD(order.refunded_amount ?? 0)} of ${fmtUSD(payment.amountUsd ?? 0)} refunded.\nPayment stays APPROVED; nothing to do unless you meant a full refund.`,
      );
    }
    return NextResponse.json({ ok: true });
  }

  const claimed = await prisma.payment.updateMany({
    where: { provider: "polar", providerRef: polarRef(orderId), status: "APPROVED" },
    data: { status: "REFUNDED" },
  });
  if (claimed.count === 0) return NextResponse.json({ ok: true }); // unknown or already handled

  if (payment) {
    emit("error", { surface: "upgrade", key: "polar_refund", userId: payment.userId, ok: false });
  }
  // Premium is NOT auto-revoked (the user may have other paid time) — the admin
  // decides in /admin/users.
  await notifyAdmin(
    `↩️ Polar refund\nOrder ${orderRef} — ${payment?.user.name} (${payment?.user.email}), ${fmtUSD(payment?.amountUsd ?? 0)}.\nPremium already granted — review in /admin/users.`,
  );
  return NextResponse.json({ ok: true });
}
