import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  CLICK_ERR,
  parseClickCallback,
  verifyClickSign,
  type ClickCallbackParams,
} from "@/lib/click";

// Click SHOP-API "Prepare" (action=0) — register this URL in the Click merchant
// cabinet: https://satway.online/api/webhooks/click/prepare
//
// Click asks us to validate the order before charging; we confirm the Payment row
// exists, is still payable, and the amount matches, then hand back a
// merchant_prepare_id that must be echoed at Complete.

function resp(p: ClickCallbackParams, error: number, note: string, prepareId?: number) {
  return NextResponse.json({
    click_trans_id: Number(p.click_trans_id) || p.click_trans_id,
    merchant_trans_id: p.merchant_trans_id,
    merchant_prepare_id: prepareId ?? 0,
    error,
    error_note: note,
  });
}

export async function POST(req: NextRequest) {
  const p = await parseClickCallback(req);
  if (!p) return NextResponse.json({ error: CLICK_ERR.BAD_REQUEST, error_note: "Bad request" });

  // Log every callback verbatim — Click support asks for these when debugging.
  console.log(
    `[click] prepare: trans=${p.click_trans_id} order=${p.merchant_trans_id} amount=${p.amount} error=${p.error}`,
  );

  if (!verifyClickSign(p)) return resp(p, CLICK_ERR.SIGN_CHECK_FAILED, "SIGN CHECK FAILED");
  if (p.action !== "0") return resp(p, CLICK_ERR.ACTION_NOT_FOUND, "Action not found");

  // transaction_param is our short orderNo — satway has never sent anything else.
  const orderNo = Number(p.merchant_trans_id);
  if (!Number.isSafeInteger(orderNo) || orderNo <= 0) {
    return resp(p, CLICK_ERR.TRANSACTION_NOT_FOUND, "Transaction not found");
  }
  const payment = await prisma.payment.findUnique({ where: { orderNo } });
  if (!payment || payment.provider !== "click") {
    return resp(p, CLICK_ERR.TRANSACTION_NOT_FOUND, "Transaction not found");
  }
  if (payment.status === "APPROVED") return resp(p, CLICK_ERR.ALREADY_PAID, "Already paid");
  if (payment.status !== "PENDING") {
    return resp(p, CLICK_ERR.TRANSACTION_CANCELLED, "Transaction cancelled");
  }

  const amount = Number.parseFloat(p.amount);
  if (!Number.isFinite(amount) || Math.abs(amount - payment.amount) > 0.01) {
    return resp(p, CLICK_ERR.INCORRECT_AMOUNT, "Incorrect amount");
  }

  // Issue (or reuse, on a Prepare retry) the prepare id Click must echo back.
  let prepareId = payment.clickPrepareId;
  if (!prepareId) {
    prepareId = Math.floor(Math.random() * 2_000_000_000) + 1;
    await prisma.payment.update({ where: { id: payment.id }, data: { clickPrepareId: prepareId } });
  }

  return resp(p, CLICK_ERR.SUCCESS, "Success", prepareId);
}
