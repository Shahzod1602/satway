import { prisma } from "@/lib/prisma";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function genReferralCode(len = 7): string {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}

export async function ensureReferralCode(userId: string): Promise<string> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { referralCode: true },
  });
  if (u?.referralCode) return u.referralCode;
  for (let i = 0; i < 6; i++) {
    const code = genReferralCode();
    try {
      await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return code;
    } catch {
      // unique collision
    }
  }
  throw new Error("Could not generate referral code");
}

export async function rewardReferrerIfNeeded(userId: string): Promise<void> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { referredById: true, referralRewarded: true },
  });
  if (!u || u.referralRewarded || !u.referredById) return;

  const referrer = await prisma.user.findUnique({
    where: { id: u.referredById },
    select: { id: true, premiumUntil: true },
  });
  if (!referrer) {
    await prisma.user.update({ where: { id: userId }, data: { referralRewarded: true } });
    return;
  }

  const base =
    referrer.premiumUntil && referrer.premiumUntil.getTime() > Date.now()
      ? referrer.premiumUntil.getTime()
      : Date.now();
  const newUntil = new Date(base + WEEK_MS);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: referrer.id },
      data: { plan: "PREMIUM", premiumUntil: newUntil },
    }),
    prisma.user.update({ where: { id: userId }, data: { referralRewarded: true } }),
  ]);
}
