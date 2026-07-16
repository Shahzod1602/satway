import { sendMail, mailConfigured } from "./mail";
import { sendTelegramMessage, escapeHtml } from "./telegram";
import { appUrl, isSyntheticEmail } from "./winback";

/**
 * How an announcement leaves the building.
 *
 * "inapp" is the support chat — instant, one DB write, and it reaches everybody, but only
 * once they next open the site. "telegram" and "email" are what reach a student who is
 * NOT on the site right now, which is the entire point of a broadcast.
 */
export type BroadcastChannel = "inapp" | "telegram" | "email";

export const CHANNELS: BroadcastChannel[] = ["inapp", "telegram", "email"];
export const isChannel = (v: unknown): v is BroadcastChannel =>
  typeof v === "string" && (CHANNELS as string[]).includes(v);

export type Recipient = {
  id: string;
  name: string | null;
  email: string | null;
  telegramId: string | null;
  emailNotifications: boolean;
};

/** Who can actually be reached on each channel. */
export function telegramEligible(r: Recipient): boolean {
  return !!r.telegramId;
}
export function emailEligible(r: Recipient): boolean {
  // Never email a Telegram-only synthetic address, and honour the notifications opt-out.
  return !!r.email && !isSyntheticEmail(r.email) && r.emailNotifications;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Telegram's global limit is ~30 messages/second; stay well under it. Email goes slower
// still, so a provider does not flag a burst as spam and torch the sending domain.
const TELEGRAM_GAP_MS = 60; // ~16/s
const EMAIL_GAP_MS = 200; // ~5/s

function marketingEmail(text: string): { subject: string; html: string; text: string } {
  const url = appUrl("/dashboard");
  const paras = text
    .split(/\n{2,}/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;line-height:1.6;color:#334155;font-size:15px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  const html = `<div style="max-width:520px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
    <div style="padding:24px 4px"><span style="font-size:20px;font-weight:800;color:#0f172a">SAT</span><span style="font-size:20px;font-weight:800;background:#2563eb;color:#fff;border-radius:6px;padding:2px 6px">way</span></div>
    ${paras}
    <a href="${url}" style="display:inline-block;margin-top:8px;background:#0f172a;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 22px;border-radius:10px">Open SATway</a>
    <p style="margin:26px 0 0;color:#94a3b8;font-size:12px;line-height:1.5">You're receiving this because you have email notifications on for your SATway account. You can turn them off in your profile.</p>
  </div>`;
  // A short, generic subject — the first line of the message is the natural headline.
  const subject = text.split("\n")[0].slice(0, 78) || "A message from SATway";
  return { subject, html, text: `${text}\n\nOpen SATway: ${url}` };
}

export type DeliveryResult = {
  telegram: { sent: number; failed: number; eligible: number };
  email: { sent: number; failed: number; eligible: number };
};

/**
 * Deliver one announcement to Telegram and/or email.
 *
 * Sequential and throttled, and meant to be run in the BACKGROUND from the broadcast
 * route: this app is a long-running server, so the work survives the HTTP response, and
 * a 400-recipient email run takes ~80 seconds — far past any sane request timeout.
 *
 * In-app delivery is the caller's job (a single createMany, so it is instant and atomic).
 */
export async function deliverBroadcast(
  recipients: Recipient[],
  text: string,
  channels: BroadcastChannel[],
): Promise<DeliveryResult> {
  const result: DeliveryResult = {
    telegram: { sent: 0, failed: 0, eligible: 0 },
    email: { sent: 0, failed: 0, eligible: 0 },
  };

  if (channels.includes("telegram")) {
    // parse_mode is HTML, so escape the admin's text — one stray `<` would otherwise make
    // Telegram 400 the send and the announcement would just never arrive.
    const html = escapeHtml(text);
    const targets = recipients.filter(telegramEligible);
    result.telegram.eligible = targets.length;
    for (const r of targets) {
      try {
        const res = await sendTelegramMessage(r.telegramId!, html, {
          button: { text: "Open SATway", url: appUrl("/dashboard") },
        });
        if (res.ok) result.telegram.sent++;
        else result.telegram.failed++;
      } catch {
        result.telegram.failed++;
      }
      await sleep(TELEGRAM_GAP_MS);
    }
  }

  if (channels.includes("email") && mailConfigured()) {
    const targets = recipients.filter(emailEligible);
    result.email.eligible = targets.length;
    const mail = marketingEmail(text);
    for (const r of targets) {
      try {
        const ok = await sendMail({
          to: r.email!,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        });
        if (ok) result.email.sent++;
        else result.email.failed++;
      } catch {
        result.email.failed++;
      }
      await sleep(EMAIL_GAP_MS);
    }
  }

  return result;
}
