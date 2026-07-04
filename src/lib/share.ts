import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

// FRIEND links let a Premium user give up to this many distinct people access to a
// single test; CLASS (teacher-style) links are uncapped.
export const FRIEND_CAP = 3;

/** A short, URL-safe share token. */
export function newShareToken(): string {
  return randomBytes(9).toString("base64url"); // ~12 chars
}

/**
 * True if the user has redeemed a still-active share link for this test — this is
 * what grants a non-Premium friend access to a single shared test (not full Premium).
 */
export async function hasShareGrant(userId: string, testId: string): Promise<boolean> {
  const use = await prisma.shareLinkUse.findFirst({
    where: { userId, shareLink: { testId, active: true } },
    select: { id: true },
  });
  return !!use;
}
