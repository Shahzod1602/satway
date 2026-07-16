import { prisma } from "@/lib/prisma";

// Statuses getChatMember returns for someone who IS currently in the chat.
// "left"/"kicked" mean they are not. For groups "restricted" can still be a
// member (is_member=true); channels only ever report the first three.
const PRESENT_STATUSES = new Set(["creator", "administrator", "member"]);

/**
 * Check whether a Telegram user is currently a member of the gate channel,
 * using the Bot API `getChatMember`. The bot (TELEGRAM_LOGIN_BOT_TOKEN by
 * default) MUST be an administrator of that channel or the API returns an
 * error — in which case we fail closed (member: false) and log the reason.
 *
 * `channelId` accepts a public @username or a numeric -100… id.
 * Never throws; returns { member, error? }.
 */
export async function isChannelMember(
  telegramId: string | number,
  opts?: { channelId?: string; token?: string },
): Promise<{ member: boolean; error?: string }> {
  const token =
    opts?.token || process.env.TELEGRAM_LOGIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  const channelId = opts?.channelId || process.env.TELEGRAM_CHANNEL_ID;
  if (!token) return { member: false, error: "no telegram bot token configured" };
  if (!channelId) return { member: false, error: "TELEGRAM_CHANNEL_ID not configured" };

  const url =
    `https://api.telegram.org/bot${token}/getChatMember` +
    `?chat_id=${encodeURIComponent(channelId)}&user_id=${encodeURIComponent(String(telegramId))}`;
  try {
    const res = await fetch(url);
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: { status?: string; is_member?: boolean };
    };
    if (!data.ok) return { member: false, error: data.description || `HTTP ${res.status}` };
    const status = data.result?.status ?? "";
    const member = PRESENT_STATUSES.has(status) || (status === "restricted" && !!data.result?.is_member);
    return { member };
  } catch (e) {
    return { member: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Escape text going into a parse_mode:"HTML" message.
 *
 * sendTelegramMessage defaults to HTML parse mode, so any admin-authored text with a
 * stray `<` or `&` makes Telegram reject the whole send with a 400 — the message just
 * silently never arrives. Escape anything that did not come from us.
 */
export function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * DM the admin. Returns whether it actually went out — unlike the notify* helpers
 * below, some callers (the AI budget watchdog) need to know, because "the alert was
 * suppressed as already-sent" and "the alert silently failed" must not look the same.
 */
export async function notifyAdmin(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return false;

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Send a Telegram notification to the admin when a user sends a support message. */
export async function notifyAdminSupport(userName: string, messagePreview: string): Promise<void> {
  await notifyAdmin(`New support message from ${userName}:\n\n${messagePreview.slice(0, 300)}`);
}

/** Send a Telegram admin notification for payment received. */
export async function notifyAdminPayment(userName: string, plan: string, amount: number): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  const text = `Payment received!\nUser: ${userName}\nPlan: ${plan}\nAmount: ${amount.toLocaleString()} UZS`;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch {
    // silently fail
  }
}

/**
 * DM a specific USER via the Telegram Bot API. Uses the LOGIN bot
 * (TELEGRAM_LOGIN_BOT_TOKEN — @satwayonlinebot, the one users authenticated
 * with) by default, since a bot can only message a user tied to it.
 *
 * NOTE: a bot can only message a user who has previously STARTED a chat with
 * it. Login-Widget users may not have, so sends can fail with 403
 * "bot can't initiate conversation with a user" — that's expected, not a crash.
 * Returns { ok, error?, blocked? } and never throws.
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  opts?: {
    button?: { text: string; url: string };
    parseMode?: "HTML" | "Markdown";
    token?: string;
  },
): Promise<{ ok: boolean; error?: string; blocked?: boolean }> {
  const token =
    opts?.token || process.env.TELEGRAM_LOGIN_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "no telegram bot token configured" };

  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: opts?.parseMode ?? "HTML",
    disable_web_page_preview: false,
  };
  if (opts?.button) {
    body.reply_markup = { inline_keyboard: [[{ text: opts.button.text, url: opts.button.url }]] };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (data.ok) return { ok: true };
    return { ok: false, error: data.description || `HTTP ${res.status}`, blocked: res.status === 403 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
