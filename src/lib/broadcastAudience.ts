import type { Prisma } from "@/generated/prisma/client";

// Who an announcement goes to. The two named student groups are deliberately disjoint and
// together they add up to EVERYONE — a student is either paying or not. Nobody gets a
// message twice and nobody is silently skipped.
//
// PREMIUM is decided the way access is decided (see isPremiumActive in lib/access): a plan
// that has run past its expiry is not premium any more, so a lapsed subscriber hears the
// "come back" announcement, not the "thanks for subscribing" one.
export const AUDIENCES = ["ALL", "FREE", "PREMIUM", "USERS"] as const;
export type Audience = (typeof AUDIENCES)[number];

export const AUDIENCE_LABELS: Record<Audience, string> = {
  ALL: "Everyone",
  FREE: "Free students",
  PREMIUM: "Premium students",
  USERS: "Selected people",
};

export function isAudience(v: unknown): v is Audience {
  return typeof v === "string" && (AUDIENCES as readonly string[]).includes(v);
}

/**
 * Prisma `where` for one audience. Admins are never a recipient — an announcement is
 * something we send out, not something we send to ourselves.
 *
 * `userIds` is only read for the USERS audience, and those ids are still filtered against
 * non-admin, so a hand-picked list cannot smuggle an admin (or a stale id) in.
 */
export function audienceWhere(audience: Audience, userIds: string[] = []): Prisma.UserWhereInput {
  const notAdmin: Prisma.UserWhereInput = { role: { not: "ADMIN" } };
  const now = new Date();

  // Mirrors isPremiumActive(): a null premiumUntil is lifetime Premium, not expired.
  const premiumActive: Prisma.UserWhereInput = {
    plan: "PREMIUM",
    OR: [{ premiumUntil: null }, { premiumUntil: { gt: now } }],
  };

  switch (audience) {
    case "ALL":
      return notAdmin;
    case "PREMIUM":
      return { AND: [{ role: "STUDENT" }, premiumActive] };
    case "FREE":
      // Everything a paying student isn't: never subscribed, or subscribed and lapsed.
      return { AND: [{ role: "STUDENT" }, { NOT: premiumActive }] };
    case "USERS":
      return { AND: [notAdmin, { id: { in: userIds } }] };
  }
}
