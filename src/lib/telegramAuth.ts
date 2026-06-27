import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { welcomePremiumUntil } from "./access";

// Payload delivered by the Telegram Login Widget's `onauth` callback.
// https://core.telegram.org/widgets/login#receiving-authorization-data
export type TelegramAuthData = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

/**
 * Verify the HMAC signature Telegram attaches to login data. The secret key is
 * SHA256(bot_token); the data-check-string is every field except `hash`, sorted
 * by key and joined with newlines as `key=value`.
 */
export function verifyTelegramAuth(data: TelegramAuthData, botToken: string): boolean {
  if (!botToken || !data?.hash) return false;

  const { hash, ...rest } = data as Record<string, unknown>;
  const dataCheckString = Object.keys(rest)
    .filter((k) => rest[k] !== undefined && rest[k] !== null)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join("\n");

  const secret = crypto.createHash("sha256").update(botToken).digest();
  const hmac = crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");

  let theirs: Buffer;
  try {
    theirs = Buffer.from(String(hash), "hex");
  } catch {
    return false;
  }
  const ours = Buffer.from(hmac, "hex");
  return ours.length === theirs.length && crypto.timingSafeEqual(ours, theirs);
}

/** Reject stale login payloads (replay protection). Default window: 15 min. */
export function isAuthFresh(authDate: number, maxAgeSec = 15 * 60): boolean {
  const now = Math.floor(Date.now() / 1000);
  return Number.isFinite(Number(authDate)) && now - Number(authDate) < maxAgeSec;
}

/**
 * Look up the account linked to this Telegram identity, creating it on first
 * login. Telegram doesn't give us an email, so we store a placeholder keyed by
 * the Telegram id and treat the account as email-verified.
 */
export async function findOrCreateTelegramUser(tg: TelegramAuthData, referralCode?: string) {
  const telegramId = String(tg.id);

  const existing = await prisma.user.findUnique({ where: { telegramId } });
  if (existing) return existing;

  const name =
    [tg.first_name, tg.last_name].filter(Boolean).join(" ").trim() ||
    tg.username ||
    `Telegram ${telegramId}`;
  const email = `tg${telegramId}@telegram.satway.online`;
  const randomPassword = await bcrypt.hash(crypto.randomUUID(), 10);

  let referredById: string | undefined;
  if (referralCode) {
    const referrer = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });
    if (referrer) referredById = referrer.id;
  }

  try {
    return await prisma.user.create({
      data: {
        name,
        email,
        password: randomPassword,
        role: "STUDENT",
        emailVerified: true,
        telegramId,
        telegramUsername: tg.username ?? null,
        avatarUrl: tg.photo_url ?? null,
        referredById,
        plan: "PREMIUM",
        premiumUntil: welcomePremiumUntil(),
      },
    });
  } catch {
    // Lost a create race against a concurrent first login — fetch the winner.
    const winner = await prisma.user.findUnique({ where: { telegramId } });
    if (winner) return winner;
    throw new Error("Could not create Telegram account");
  }
}
