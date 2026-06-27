import { prisma } from "@/lib/prisma";

/** Send a Telegram notification to the admin when a user sends a support message. */
export async function notifyAdminSupport(userName: string, messagePreview: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return;

  const text = `New support message from ${userName}:\n\n${messagePreview.slice(0, 300)}`;
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
