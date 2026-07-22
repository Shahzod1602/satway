import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CLICK_ERR,
  parseClickCallback,
  verifyClickSign,
  type ClickCallbackParams,
} from "@/lib/click";
import { grantPremiumMonths } from "@/lib/grantPremium";
import { rewardReferrerIfNeeded } from "@/lib/referral";
import { fmtUZS } from "@/lib/plans";
import { notifyAdmin } from "@/lib/telegram";
import { emit } from "@/lib/events";

// Click SHOP-API "Complete" (action=1) — register this URL in the Click merchant
// cabinet: https://satway.online/api/webhooks/click/complete
//
// Fires after the user pays (or the transaction fails on Click's side).
// Idempotent: the PENDING→APPROVED claim makes Complete retries no-ops.

function resp(p: ClickCallbackParams, error: number, note: string, confirmId?: number) {
  return NextResponse.json({
    click_trans_id: Number(p.click_trans_id) || p.click_trans_id,
    merchant_trans_id: p.merchant_trans_id,
    merchant_confirm_id: confirmId ?? 0,
    error,
    error_note: note,
  });
}

export async function POST(req: NextRequest) {
  const p = await parseClickCallback(req);
  if (!p) return NextResponse.json({ error: CLICK_ERR.BAD_REQUEST, error_note: "Bad request" });

  // Log every callback verbatim — Click support asks for these when debugging.
  console.log(
    `[click] complete: trans=${p.click_trans_id} paydoc=${p.click_paydoc_id ?? "-"} order=${p.merchant_trans_id} amount=${p.amount} error=${p.error}`,
  );

  if (!verifyClickSign(p)) return resp(p, CLICK_ERR.SIGN_CHECK_FAILED, "SIGN CHECK FAILED");
  if (p.action !== "1") return resp(p, CLICK_ERR.ACTION_NOT_FOUND, "Action not found");

  const orderNo = Number(p.merchant_trans_id);
  if (!Number.isSafeInteger(orderNo) || orderNo <= 0) {
    return resp(p, CLICK_ERR.TRANSACTION_NOT_FOUND, "Transaction not found");
  }
  const payment = await prisma.payment.findUnique({
    where: { orderNo },
    include: {
      user: { select: { name: true, email: true } },
      promoOwner: { select: { name: true } },
    },
  });
  if (!payment || payment.provider !== "click") {
    return resp(p, CLICK_ERR.TRANSACTION_NOT_FOUND, "Transaction not found");
  }

  // Click reports its own failure/cancellation with a negative error code.
  const clickError = Number.parseInt(p.error, 10) || 0;
  if (clickError < 0) {
    if (payment.status === "PENDING") {
      await prisma.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: "CANCELLED" },
      });
      console.log(`[click] cancelled: order=${payment.orderNo} clickError=${clickError}`);
    } else if (payment.status === "APPROVED") {
      // Reversal of an already-confirmed payment — the money went back, but Premium was
      // already granted. That mismatch needs a human decision, loudly.
      await prisma.payment.updateMany({
        where: { id: payment.id, status: "APPROVED" },
        data: { status: "REFUNDED" },
      });
      emit("error", {
        surface: "upgrade",
        key: "click_reversal",
        userId: payment.userId,
        ok: false,
      });
      await notifyAdmin(
        `↩️ Click REVERSAL · order SW-${String(payment.orderNo).padStart(6, "0")}\n${payment.user.name} (${payment.user.email}), ${fmtUZS(payment.amount)} UZS.\nPremium already granted — review in /admin/users.`,
      );
    }
    return resp(p, CLICK_ERR.TRANSACTION_CANCELLED, "Transaction cancelled");
  }

  if (payment.status === "APPROVED") {
    return resp(p, CLICK_ERR.ALREADY_PAID, "Already paid", payment.clickPrepareId ?? 0);
  }
  if (payment.status !== "PENDING") {
    return resp(p, CLICK_ERR.TRANSACTION_CANCELLED, "Transaction cancelled");
  }

  if (!payment.clickPrepareId || String(payment.clickPrepareId) !== (p.merchant_prepare_id ?? "")) {
    return resp(p, CLICK_ERR.PREPARE_NOT_FOUND, "Prepare transaction not found");
  }

  const amount = Number.parseFloat(p.amount);
  if (!Number.isFinite(amount) || Math.abs(amount - payment.amount) > 0.01) {
    return resp(p, CLICK_ERR.INCORRECT_AMOUNT, "Incorrect amount");
  }

  // Claim + grant atomically; a thrown error rolls back and our non-success response
  // makes Click retry.
  const granted = await prisma.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        status: "APPROVED",
        providerRef: `click:${p.click_trans_id}`,
        paidAt: new Date(),
      },
    });
    if (claim.count === 0) return null; // a concurrent Complete won the race
    return { user: await grantPremiumMonths(tx, payment.userId, payment.months) };
  });

  if (!granted) return resp(p, CLICK_ERR.ALREADY_PAID, "Already paid", payment.clickPrepareId);
  if (!granted.user) {
    await notifyAdmin(
      `⚠️ Click transaction ${p.click_trans_id} paid, but the user of order SW-${String(payment.orderNo).padStart(6, "0")} no longer exists. Refund it via Click.`,
    );
    return resp(p, CLICK_ERR.SUCCESS, "Success", payment.clickPrepareId);
  }

  // Post-commit extras must never fail the callback after the money-critical work
  // committed — Click would retry into the already-paid path.
  try {
    await rewardReferrerIfNeeded(payment.userId); // idempotent (atomic claim inside)
  } catch (e) {
    console.error("[click] referral reward failed:", (e as Error).message);
  }

  const commission =
    payment.promoOwnerId && payment.commissionPct > 0
      ? Math.round(payment.amount * (payment.commissionPct / 100))
      : 0;
  await notifyAdmin(
    [
      `💳 Click payment · order SW-${String(payment.orderNo).padStart(6, "0")} (SATway)`,
      `${granted.user.name} (${granted.user.email})`,
      `Plan: ${payment.planLabel} — ${fmtUZS(payment.amount)} UZS`,
      payment.promoCode ? `Promo: ${payment.promoCode} (−${payment.discountPercent}%)` : null,
      commission > 0 && payment.promoOwner
        ? `Owner: ${payment.promoOwner.name} — share ${fmtUZS(commission)} UZS (${payment.commissionPct}%)`
        : null,
      `Premium: until ${granted.user.premiumUntil.toISOString().slice(0, 10)}`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return resp(p, CLICK_ERR.SUCCESS, "Success", payment.clickPrepareId);
}
