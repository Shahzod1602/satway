import { prisma } from "./prisma";

/**
 * Subscription gate — users unlock the (free) app by following on Instagram
 * and joining the Telegram channel. Entirely config-driven: the gate turns on
 * only when at least one target is configured, so an empty env = feature off.
 *
 * Env:
 *   INSTAGRAM_URL              — profile to follow (enables the IG step)
 *   TELEGRAM_CHANNEL_URL       — https://t.me/… join link (button target)
 *   TELEGRAM_CHANNEL_ID        — @username or -100… id (enables the verified TG step)
 *   NEXT_PUBLIC_TELEGRAM_BOT_USERNAME — login-widget bot (for linking email users)
 */
export type GateConfig = {
  enabled: boolean;
  requireInstagram: boolean;
  requireTelegram: boolean;
  instagramUrl: string | null;
  channelUrl: string | null;
  channelId: string | null;
  botUsername: string;
};

export function gateConfig(): GateConfig {
  const instagramUrl = process.env.INSTAGRAM_URL || process.env.NEXT_PUBLIC_INSTAGRAM_URL || null;
  const channelUrl =
    process.env.TELEGRAM_CHANNEL_URL || process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL || null;
  const channelId = process.env.TELEGRAM_CHANNEL_ID || null;

  const requireInstagram = !!instagramUrl;
  const requireTelegram = !!channelId;

  return {
    enabled: requireInstagram || requireTelegram,
    requireInstagram,
    requireTelegram,
    instagramUrl,
    channelUrl,
    channelId,
    botUsername: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "satwayonlinebot",
  };
}

export type GateStatus = { ig: boolean; tg: boolean; passed: boolean };

/** Compute pass/fail from a user's stored flags against the active config. */
export function computeGateStatus(
  cfg: GateConfig,
  u: { igFollowedAt: Date | null; tgSubVerifiedAt: Date | null },
): GateStatus {
  const ig = !cfg.requireInstagram || !!u.igFollowedAt;
  const tg = !cfg.requireTelegram || !!u.tgSubVerifiedAt;
  return { ig, tg, passed: ig && tg };
}

/** Load a user's gate flags (plus telegramId) and evaluate them. */
export async function gateStatusForUser(
  cfg: GateConfig,
  userId: string,
): Promise<GateStatus & { telegramId: string | null }> {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { igFollowedAt: true, tgSubVerifiedAt: true, telegramId: true },
  });
  if (!u) return { ig: false, tg: false, passed: false, telegramId: null };
  return { ...computeGateStatus(cfg, u), telegramId: u.telegramId };
}

/**
 * httpOnly cookie set once the gate is cleared, so the Edge middleware can wave
 * the user through without a DB read. The DB flags remain the source of truth
 * (see /api/onboarding/sync), so a cleared cookie just re-derives from them.
 */
export const GATE_COOKIE = "sat_gate";
export const GATE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
