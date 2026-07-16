// What a purchase actually costs, decided on the server.
//
// This is the seam a payment provider plugs into. Today the only provider is "manual"
// (a bank-card transfer an admin eyeballs), but every automated provider needs the same
// three things this file produces: a plan, an amount, and an order id. Getting them from
// one place means adding Payme or Click later touches a webhook and nothing else.
//
// THE RULE: the client sends a plan id and a promo string. It never sends an amount, and
// an amount it did send would be ignored. A checkout that trusts a client-supplied price
// is a checkout that sells Premium for 1 so'm to anyone who opens dev tools.

import { prisma } from "./prisma";
import { getPlan, type PremiumPlan } from "./plans";

export type PromoResolution = {
  code: string;
  percentOff: number;
  ownerId: string | null;
  commissionPct: number;
};

export type CheckoutIntent = {
  plan: PremiumPlan;
  baseAmount: number; // list price
  amount: number; // what they owe after the discount
  discountPercent: number;
  promo: PromoResolution | null;
};

export type PromoError =
  | "not_found"
  | "inactive"
  | "expired"
  | "exhausted"
  | "self_use";

/**
 * Resolve a promo code for a specific buyer.
 *
 * Returns a discriminated result rather than throwing, because "your code is expired" is
 * a normal thing to tell someone at checkout, not an exception.
 */
export async function resolvePromo(
  rawCode: string,
  buyerId: string,
): Promise<{ ok: true; promo: PromoResolution } | { ok: false; error: PromoError }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "not_found" };

  const row = await prisma.promoCode.findUnique({ where: { code } });
  if (!row) return { ok: false, error: "not_found" };
  if (!row.active) return { ok: false, error: "inactive" };
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return { ok: false, error: "expired" };
  if (row.maxUses !== null && row.usedCount >= row.maxUses) return { ok: false, error: "exhausted" };
  // A teacher buying Premium with their own code would earn commission on their own
  // purchase — a discount and a kickback, funded entirely by us.
  if (row.ownerId && row.ownerId === buyerId) return { ok: false, error: "self_use" };

  return {
    ok: true,
    promo: {
      code: row.code,
      percentOff: row.percentOff,
      ownerId: row.ownerId,
      commissionPct: row.commissionPct,
    },
  };
}

export const PROMO_ERROR_MESSAGE: Record<PromoError, string> = {
  not_found: "That code doesn't exist.",
  inactive: "That code is no longer active.",
  expired: "That code has expired.",
  exhausted: "That code has been fully used.",
  self_use: "You can't use your own code.",
};

/**
 * Price one purchase. The single source of truth for what a student owes.
 *
 * An unusable promo is NOT an error here — it resolves to full price. The validate
 * endpoint tells the student their code is bad while they can still fix it; by the time
 * they are paying, silently charging list price beats failing the whole checkout.
 */
export async function resolveCheckoutIntent(opts: {
  planId: string;
  buyerId: string;
  promoCode?: string | null;
}): Promise<{ ok: true; intent: CheckoutIntent } | { ok: false; error: "bad_plan" }> {
  const plan = getPlan(opts.planId);
  if (!plan) return { ok: false, error: "bad_plan" };

  let promo: PromoResolution | null = null;
  if (opts.promoCode) {
    const r = await resolvePromo(opts.promoCode, opts.buyerId);
    if (r.ok) promo = r.promo;
  }

  const baseAmount = plan.total;
  const discountPercent = promo ? Math.max(0, Math.min(100, promo.percentOff)) : 0;
  // Round to whole so'm. UZS has no minor unit in practice, and a fractional amount would
  // be rejected by every provider here.
  const amount = Math.round(baseAmount * (1 - discountPercent / 100));

  return { ok: true, intent: { plan, baseAmount, amount, discountPercent, promo } };
}

/**
 * Commission owed on one paid sale, in so'm.
 *
 * Reads ONLY the snapshot columns on the Payment row — never the live PromoCode. Both the
 * owner and the rate are snapshotted, so renegotiating a teacher from 50% to 30% changes
 * what they earn on the NEXT sale and nothing about what they are already owed.
 */
export function commissionFor(payment: {
  amount: number;
  promoOwnerId: string | null;
  commissionPct: number;
}): number {
  if (!payment.promoOwnerId) return 0;
  return Math.round(payment.amount * (payment.commissionPct / 100));
}

/** "SW-000042" — what a student quotes and an admin searches for. */
export const formatOrderNo = (n: number | null | undefined): string =>
  n == null ? "—" : `SW-${String(n).padStart(6, "0")}`;
