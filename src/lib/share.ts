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

/** Human-friendly live-session join code (no ambiguous chars). */
export function newLiveCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(randomBytes(6), (x) => chars[x % chars.length]).join("");
}

/** True if the user is a participant of a LIVE session for this test (host started it). */
export async function hasLiveGrant(userId: string, testId: string): Promise<boolean> {
  const p = await prisma.liveParticipant.findFirst({
    where: { userId, session: { testId, status: "LIVE" } },
    select: { id: true },
  });
  return !!p;
}

/** Combined non-Premium access grant for a test (share link OR live session). */
export async function hasTestGrant(userId: string, testId: string): Promise<boolean> {
  return (await hasShareGrant(userId, testId)) || (await hasLiveGrant(userId, testId));
}
