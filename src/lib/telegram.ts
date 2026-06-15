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
