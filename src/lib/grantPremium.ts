// The one place Premium is actually granted.
//
// Two callers: an admin approving a manual transfer, and the Click Complete webhook.
// They MUST share this code — the day they diverge, one of them forgets the
// extend-from-current-expiry rule and a renewing student loses the tail of their old
// subscription, which is the kind of bug that arrives as an angry support message.

import type { Prisma } from "@/generated/prisma/client";
import { nextPremiumUntil } from "./premium";

type Tx = Prisma.TransactionClient;

/**
 * Extend a user's Premium by N months, from their current expiry if it is still in the
 * future. Runs inside the caller's transaction — the caller owns the atomic claim on the
 * Payment row (PENDING → APPROVED), which is what makes retries and races no-ops.
 *
 * Returns the user it granted to, or null if the user no longer exists (deleted account
 * with a payment in flight — the caller must tell an admin to refund, not crash).
 */
export async function grantPremiumMonths(
  tx: Tx,
  userId: string,
  months: number,
): Promise<{ name: string; email: string; premiumUntil: Date } | null> {
  const u = await tx.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true, premiumUntil: true },
  });
  if (!u) return null;

  const premiumUntil = nextPremiumUntil(u.premiumUntil, months);
  await tx.user.update({
    where: { id: userId },
    data: { plan: "PREMIUM", premiumUntil },
  });
  return { name: u.name, email: u.email, premiumUntil };
}
