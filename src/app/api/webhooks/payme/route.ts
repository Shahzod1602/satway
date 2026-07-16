import { NextRequest, NextResponse } from "next/server";
import type { Payment } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  PAYME_ACCOUNT_FIELD,
  PAYME_ERR,
  PAYME_STATE,
  PAYME_TIMEOUT_MS,
  ms,
  paymeError,
  paymeResult,
  verifyPaymeAuth,
} from "@/lib/payme";
import { grantPremiumMonths } from "@/lib/grantPremium";
import { rewardReferrerIfNeeded } from "@/lib/referral";
import { fmtUZS } from "@/lib/plans";
import { notifyAdmin } from "@/lib/telegram";

// Payme Merchant API endpoint — register this URL in the Payme cabinet:
// https://satway.online/api/webhooks/payme (account field: "order_id").
//
// One JSON-RPC endpoint drives the whole transaction. EVERY response leaves here with
// HTTP 200 — Payme reads any other status as RPC error -32400 and keeps retrying.
// Idempotency comes from the same PENDING→APPROVED claim Click uses, plus Payme's own
// transaction id (paymeTransId) being unique on the row.

/** Our side of a transaction, in the shape Payme's methods return it. */
const txView = (p: Payment) => ({
  create_time: ms(p.paymeCreatedAt),
  perform_time: ms(p.paidAt),
  cancel_time: ms(p.paymeCancelledAt),
  transaction: String(p.orderNo),
  state: p.paymeState ?? PAYME_STATE.CREATED,
  reason: p.paymeCancelReason ?? null,
});

/** Resolve `account.order_id` → the Payment row it names (or null). */
async function findOrder(account: unknown): Promise<Payment | null> {
  const raw = (account as Record<string, unknown> | null | undefined)?.[PAYME_ACCOUNT_FIELD];
  const orderNo = Number(raw);
  if (!Number.isSafeInteger(orderNo) || orderNo <= 0) return null;
  const payment = await prisma.payment.findUnique({ where: { orderNo } });
  return payment?.provider === "payme" ? payment : null;
}

const findTx = (id: unknown): Promise<Payment | null> =>
  typeof id === "string" && id
    ? prisma.payment.findUnique({ where: { paymeTransId: id } })
    : Promise.resolve(null);

/** Amounts travel in tiyin; the row stores so'm. */
const tiyin = (p: Payment) => p.amount * 100;

/**
 * A transaction Payme has held for 12h without paying is dead: cancel it (reason 4)
 * so Payme's own timeout and ours agree, then refuse the operation.
 */
async function expire(p: Payment): Promise<void> {
  await prisma.payment.updateMany({
    where: { id: p.id, status: "PENDING" },
    data: {
      status: "CANCELLED",
      paymeState: PAYME_STATE.CANCELLED,
      paymeCancelledAt: new Date(),
      paymeCancelReason: 4, // timeout
    },
  });
  console.log(`[payme] expired: order=${p.orderNo} trans=${p.paymeTransId}`);
}

const timedOut = (p: Payment) => Date.now() - ms(p.paymeCreatedAt) > PAYME_TIMEOUT_MS;

// ── Methods ─────────────────────────────────────────────────────────────────

async function checkPerformTransaction(id: unknown, params: Record<string, unknown>) {
  const order = await findOrder(params.account);
  if (!order) return paymeError(id, PAYME_ERR.ORDER_NOT_FOUND, PAYME_ACCOUNT_FIELD);
  if (Number(params.amount) !== tiyin(order)) return paymeError(id, PAYME_ERR.WRONG_AMOUNT);
  if (order.status !== "PENDING") {
    return paymeError(id, PAYME_ERR.ORDER_NOT_PAYABLE, PAYME_ACCOUNT_FIELD);
  }
  return paymeResult(id, { allow: true });
}

async function createTransaction(id: unknown, params: Record<string, unknown>) {
  // Payme re-sends CreateTransaction for a transaction it already created: answer with
  // the same row, not a second one.
  const existing = await findTx(params.id);
  if (existing) {
    if (existing.paymeState !== PAYME_STATE.CREATED) return paymeError(id, PAYME_ERR.CANT_PERFORM);
    if (timedOut(existing)) {
      await expire(existing);
      return paymeError(id, PAYME_ERR.CANT_PERFORM);
    }
    const v = txView(existing);
    return paymeResult(id, { create_time: v.create_time, transaction: v.transaction, state: v.state });
  }

  const order = await findOrder(params.account);
  if (!order) return paymeError(id, PAYME_ERR.ORDER_NOT_FOUND, PAYME_ACCOUNT_FIELD);
  if (Number(params.amount) !== tiyin(order)) return paymeError(id, PAYME_ERR.WRONG_AMOUNT);
  if (order.status !== "PENDING") {
    return paymeError(id, PAYME_ERR.ORDER_NOT_PAYABLE, PAYME_ACCOUNT_FIELD);
  }
  // The order is already held by a DIFFERENT Payme transaction that hasn't resolved
  // yet. Payme reads this as "the account can't take a new payment", not "the
  // transaction can't proceed", so it must be an account error in -31050..-31099
  // (the sandbox rejects -31008 here). The buyer's other checkout tab has to finish
  // or time out first.
  if (order.paymeTransId) return paymeError(id, PAYME_ERR.ORDER_NOT_PAYABLE, PAYME_ACCOUNT_FIELD);
  if (typeof params.id !== "string" || !params.id) return paymeError(id, PAYME_ERR.INVALID_REQUEST);

  const createdAt = new Date();
  // Guarded write: two concurrent CreateTransactions for the same order can't both
  // claim it — the loser of this race lost the order to someone else, which is the
  // same "account not payable" case as the check above, so answer it the same way
  // (-31050..-31099, never -31008).
  const claim = await prisma.payment.updateMany({
    where: { id: order.id, status: "PENDING", paymeTransId: null },
    data: {
      paymeTransId: params.id,
      paymeState: PAYME_STATE.CREATED,
      paymeCreatedAt: createdAt,
    },
  });
  if (claim.count === 0) return paymeError(id, PAYME_ERR.ORDER_NOT_PAYABLE, PAYME_ACCOUNT_FIELD);

  console.log(`[payme] create: order=${order.orderNo} trans=${params.id}`);
  return paymeResult(id, {
    create_time: createdAt.getTime(),
    transaction: String(order.orderNo),
    state: PAYME_STATE.CREATED,
  });
}

async function performTransaction(id: unknown, params: Record<string, unknown>) {
  const payment = await findTx(params.id);
  if (!payment) return paymeError(id, PAYME_ERR.TX_NOT_FOUND);

  // Already performed — Payme retried. Return the SAME perform_time.
  if (payment.paymeState === PAYME_STATE.PERFORMED) {
    const v = txView(payment);
    return paymeResult(id, { transaction: v.transaction, perform_time: v.perform_time, state: v.state });
  }
  if (payment.paymeState !== PAYME_STATE.CREATED) return paymeError(id, PAYME_ERR.CANT_PERFORM);
  if (timedOut(payment)) {
    await expire(payment);
    return paymeError(id, PAYME_ERR.CANT_PERFORM);
  }

  const paidAt = new Date();
  const granted = await prisma.$transaction(async (tx) => {
    const claim = await tx.payment.updateMany({
      where: { id: payment.id, status: "PENDING" },
      data: {
        status: "APPROVED",
        providerRef: `payme:${payment.paymeTransId}`,
        paidAt,
        paymeState: PAYME_STATE.PERFORMED,
      },
    });
    if (claim.count === 0) return null; // a concurrent Perform won the race
    return { user: await grantPremiumMonths(tx, payment.userId, payment.months) };
  });

  if (!granted) {
    // The other delivery committed the grant; report ITS perform_time.
    const fresh = await findTx(params.id);
    if (!fresh || fresh.paymeState !== PAYME_STATE.PERFORMED) return paymeError(id, PAYME_ERR.CANT_PERFORM);
    const v = txView(fresh);
    return paymeResult(id, { transaction: v.transaction, perform_time: v.perform_time, state: v.state });
  }

  const ok = paymeResult(id, {
    transaction: String(payment.orderNo),
    perform_time: paidAt.getTime(),
    state: PAYME_STATE.PERFORMED,
  });

  if (!granted.user) {
    await notifyAdmin(
      `⚠️ Payme transaction ${String(params.id)} paid, but the user of order SW-${String(payment.orderNo).padStart(6, "0")} no longer exists. Refund it in the Payme cabinet.`,
    );
    return ok;
  }

  // Post-commit extras must never fail the callback after the money-critical work
  // committed — Payme would retry into the already-performed path.
  try {
    await rewardReferrerIfNeeded(payment.userId); // idempotent (atomic claim inside)
  } catch (e) {
    console.error("[payme] referral reward failed:", (e as Error).message);
  }

  const commission =
    payment.promoOwnerId && payment.commissionPct > 0
      ? Math.round(payment.amount * (payment.commissionPct / 100))
      : 0;
  const owner = payment.promoOwnerId
    ? await prisma.user.findUnique({ where: { id: payment.promoOwnerId }, select: { name: true } })
    : null;
  await notifyAdmin(
    [
      `💳 Payme to'lov · order SW-${String(payment.orderNo).padStart(6, "0")} (SATway)`,
      `${granted.user.name} (${granted.user.email})`,
      `Plan: ${payment.planLabel} — ${fmtUZS(payment.amount)} UZS`,
      payment.promoCode ? `Promo: ${payment.promoCode} (−${payment.discountPercent}%)` : null,
      commission > 0 && owner
        ? `Owner: ${owner.name} — ulush ${fmtUZS(commission)} UZS (${payment.commissionPct}%)`
        : null,
      `Premium: ${granted.user.premiumUntil.toISOString().slice(0, 10)} gacha`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return ok;
}

async function cancelTransaction(id: unknown, params: Record<string, unknown>) {
  const payment = await findTx(params.id);
  if (!payment) return paymeError(id, PAYME_ERR.TX_NOT_FOUND);

  // Already cancelled — Payme retried. Return the SAME cancel_time and state.
  if (payment.paymeState === PAYME_STATE.CANCELLED || payment.paymeState === PAYME_STATE.CANCELLED_AFTER_PERFORM) {
    const v = txView(payment);
    return paymeResult(id, { transaction: v.transaction, cancel_time: v.cancel_time, state: v.state });
  }

  const reason = Number(params.reason) || null;
  const cancelledAt = new Date();
  // Before the money moved → -1 and the order simply dies. After → -2: this is a
  // refund, so the row becomes REFUNDED and an admin decides what to do about the
  // Premium we already granted (same policy as a Click reversal — never revoke access
  // silently under a student mid-test).
  const performed = payment.paymeState === PAYME_STATE.PERFORMED;
  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: performed ? "REFUNDED" : "CANCELLED",
      paymeState: performed ? PAYME_STATE.CANCELLED_AFTER_PERFORM : PAYME_STATE.CANCELLED,
      paymeCancelledAt: cancelledAt,
      paymeCancelReason: reason,
    },
  });
  console.log(`[payme] cancelled: order=${payment.orderNo} performed=${performed} reason=${reason}`);

  if (performed) {
    const u = await prisma.user.findUnique({
      where: { id: payment.userId },
      select: { name: true, email: true },
    });
    await notifyAdmin(
      `↩️ Payme REFUND · order SW-${String(payment.orderNo).padStart(6, "0")}\n${u?.name ?? "—"} (${u?.email ?? "—"}), ${fmtUZS(payment.amount)} UZS.\nPremium allaqachon berilgan — /admin/users da ko'rib chiqing.`,
    );
  }

  return paymeResult(id, {
    transaction: String(payment.orderNo),
    cancel_time: cancelledAt.getTime(),
    state: performed ? PAYME_STATE.CANCELLED_AFTER_PERFORM : PAYME_STATE.CANCELLED,
  });
}

async function checkTransaction(id: unknown, params: Record<string, unknown>) {
  const payment = await findTx(params.id);
  if (!payment) return paymeError(id, PAYME_ERR.TX_NOT_FOUND);
  return paymeResult(id, txView(payment));
}

async function getStatement(id: unknown, params: Record<string, unknown>) {
  const from = Number(params.from);
  const to = Number(params.to);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return paymeError(id, PAYME_ERR.INVALID_REQUEST);

  const rows = await prisma.payment.findMany({
    where: {
      provider: "payme",
      paymeTransId: { not: null },
      paymeCreatedAt: { gte: new Date(from), lte: new Date(to) },
    },
    orderBy: { paymeCreatedAt: "asc" },
  });

  return paymeResult(id, {
    transactions: rows.map((p) => ({
      id: p.paymeTransId,
      time: ms(p.paymeCreatedAt),
      amount: tiyin(p),
      account: { [PAYME_ACCOUNT_FIELD]: String(p.orderNo) },
      ...txView(p),
    })),
  });
}

// ── Dispatch ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: { id?: unknown; method?: unknown; params?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(paymeError(null, PAYME_ERR.PARSE));
  }

  const rpcId = body?.id ?? null;

  // Payme authenticates with Basic auth (login "Paycom"). Check it BEFORE touching
  // the DB — an unauthenticated caller must learn nothing about orders.
  if (!verifyPaymeAuth(req.headers.get("authorization"))) {
    console.log(`[payme] unauthorized call, method=${body?.method ?? "?"}`);
    return NextResponse.json(paymeError(rpcId, PAYME_ERR.UNAUTHORIZED));
  }

  const method = typeof body?.method === "string" ? body.method : "";
  const params = (body?.params ?? {}) as Record<string, unknown>;
  console.log(`[payme] rpc: ${method} trans=${params.id ?? "-"}`);

  try {
    switch (method) {
      case "CheckPerformTransaction":
        return NextResponse.json(await checkPerformTransaction(rpcId, params));
      case "CreateTransaction":
        return NextResponse.json(await createTransaction(rpcId, params));
      case "PerformTransaction":
        return NextResponse.json(await performTransaction(rpcId, params));
      case "CancelTransaction":
        return NextResponse.json(await cancelTransaction(rpcId, params));
      case "CheckTransaction":
        return NextResponse.json(await checkTransaction(rpcId, params));
      case "GetStatement":
        return NextResponse.json(await getStatement(rpcId, params));
      default:
        return NextResponse.json(paymeError(rpcId, PAYME_ERR.METHOD_NOT_FOUND));
    }
  } catch (e) {
    // Never 500 at Payme: a non-200 reads as -32400 and it retries blindly. Tell it
    // "couldn't do it" so the money-critical methods are retried cleanly.
    console.error(`[payme] ${method} failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json(paymeError(rpcId, PAYME_ERR.CANT_PERFORM));
  }
}
