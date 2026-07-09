import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/session";
import { jsonError, tooManyRequests, withErrorHandling } from "@/lib/apiError";
import { rateLimit } from "@/lib/rateLimit";
import { gateConfig, computeGateStatus } from "@/lib/onboarding";
import { isChannelMember } from "@/lib/telegram";
import { verifyTelegramAuth, isAuthFresh, type TelegramAuthData } from "@/lib/telegramAuth";

/**
 * Verify (and, for email accounts, first link) that the current user joined the
 * Telegram channel. Body may include `data` — the signed Telegram Login Widget
 * payload — which we use to attach a Telegram identity to an email account that
 * doesn't have one yet. TG-login accounts already carry `telegramId`, so they
 * post an empty body and we just re-check membership.
 */
export const POST = withErrorHandling(async (req: NextRequest) => {
  const sessionUser = await currentUser();
  if (!sessionUser) return jsonError("Authorization required", 401);

  const cfg = gateConfig();
  if (!cfg.requireTelegram) return jsonError("Telegram step is not enabled", 400);

  const rl = rateLimit(`onboard-tg:${sessionUser.id}`, 20, 5 * 60 * 1000);
  if (!rl.ok) return tooManyRequests(300);

  const body = (await req.json().catch(() => ({}))) as { data?: string };

  // Resolve the Telegram id to check membership for.
  const me = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { telegramId: true },
  });
  let telegramId = me?.telegramId ?? null;

  // No linked identity yet → link it from the widget payload (email accounts).
  if (!telegramId && body.data) {
    const token = process.env.TELEGRAM_LOGIN_BOT_TOKEN;
    if (!token) return jsonError("Telegram sign-in is not configured", 500);

    let tg: TelegramAuthData;
    try {
      tg = JSON.parse(body.data);
    } catch {
      return jsonError("Invalid Telegram authorization data", 400);
    }
    if (!verifyTelegramAuth(tg, token)) return jsonError("Telegram verification failed", 401);
    if (!isAuthFresh(tg.auth_date)) return jsonError("Telegram login expired. Please try again.", 401);

    const tgId = String(tg.id);
    const owner = await prisma.user.findUnique({
      where: { telegramId: tgId },
      select: { id: true },
    });
    if (owner && owner.id !== sessionUser.id) {
      return jsonError(
        "This Telegram account is already linked to another SATWAY account. Please sign in with Telegram instead.",
        409,
      );
    }
    if (!owner) {
      try {
        await prisma.user.update({
          where: { id: sessionUser.id },
          data: { telegramId: tgId, telegramUsername: tg.username ?? null },
        });
      } catch {
        return jsonError("Could not link your Telegram account. Please try again.", 409);
      }
    }
    telegramId = tgId;
  }

  if (!telegramId) {
    return jsonError("Connect your Telegram account first.", 400, { needsLink: true });
  }

  // The real check: is this user actually in the channel?
  const { member, error } = await isChannelMember(telegramId, { channelId: cfg.channelId! });
  if (error) console.error("[onboarding/telegram] getChatMember:", error);

  if (!member) {
    // Not joined yet (or the bot can't read the channel — logged above).
    const current = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: { igFollowedAt: true, tgSubVerifiedAt: true },
    });
    return Response.json({
      ok: false,
      joined: false,
      status: computeGateStatus(cfg, current ?? { igFollowedAt: null, tgSubVerifiedAt: null }),
    });
  }

  const updated = await prisma.user.update({
    where: { id: sessionUser.id },
    data: { tgSubVerifiedAt: new Date() },
    select: { igFollowedAt: true, tgSubVerifiedAt: true },
  });

  return Response.json({ ok: true, joined: true, status: computeGateStatus(cfg, updated) });
});
