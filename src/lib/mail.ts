import nodemailer, { type Transporter } from "nodemailer";
import { Resend } from "resend";

let transporter: Transporter | null = null;
let resendClient: Resend | null = null;

const resendConfigured = () => !!process.env.RESEND_API_KEY;
const gmailConfigured = () =>
  !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

export function mailConfigured(): boolean {
  return resendConfigured() || gmailConfigured();
}

function getTransporter(): Transporter | null {
  if (!gmailConfigured()) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      requireTLS: true,
      pool: true,
      maxConnections: 3,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }
  return transporter;
}

function getResend(): Resend | null {
  if (!resendConfigured()) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
}): Promise<boolean> {
  const resend = getResend();
  if (resend) {
    const from = process.env.RESEND_FROM || "SATway <noreply@satway.online>";
    const { data, error } = await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? "",
      attachments: opts.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
      })),
    });
    if (error) {
      console.error("[mail] resend error:", error);
      throw new Error(error.message);
    }
    console.log(`[mail] resend sent to ${opts.to} | id=${data?.id}`);
    return true;
  }

  const t = getTransporter();
  if (!t) {
    // Don't log the subject — OTP/reset subjects embed the live code.
    console.log(`[mail] not configured — would send to ${opts.to}`);
    return false;
  }
  const from = process.env.MAIL_FROM || `SATway <${process.env.GMAIL_USER}>`;
  const info = await t.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    attachments: opts.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      encoding: "base64" as const,
      contentType: a.contentType,
    })),
  });
  console.log(
    `[mail] gmail sent to ${opts.to} | accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(info.rejected)} response="${info.response}"`,
  );
  return true;
}

export function verificationEmail(code: string): { subject: string; html: string; text: string } {
  return {
    subject: `${code} is your satway verification code`,
    text: `Your satway verification code is ${code}. It expires in 10 minutes.`,
    html: `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <div style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:24px">
      SAT<span style="background:#2563eb;color:#fff;border-radius:6px;padding:2px 6px">way</span>
    </div>
    <h1 style="font-size:18px;color:#0f172a;margin:0 0 8px">Confirm your email</h1>
    <p style="font-size:14px;color:#475569;margin:0 0 20px">
      Use the code below to finish creating your satway account.
    </p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#2563eb;background:#eff6ff;border-radius:12px;padding:18px;text-align:center">
      ${code}
    </div>
    <p style="font-size:13px;color:#94a3b8;margin:20px 0 0">
      This code expires in 10 minutes. If you didn't request it, you can ignore this email.
    </p>
  </div>`,
  };
}

/**
 * The first email a new account gets that is not a code.
 *
 * Until now registration sent an OTP and then nothing — the account's whole inbox
 * relationship with the product began with a win-back message weeks later, if at all.
 * This one exists to do one job: get them to take a test today, while they are still
 * here. So it points at exactly one action and says how long it takes.
 */
export function welcomeEmail(opts: {
  name?: string | null;
  trialDays: number;
  appUrl: string;
}): { subject: string; html: string; text: string } {
  const name = (opts.name ?? "").trim().split(/\s+/)[0] || "there";
  const url = `${opts.appUrl}/dashboard`;
  const trial =
    opts.trialDays > 0
      ? `<p style="font-size:14px;color:#475569;margin:0 0 20px">
           Your account starts with <strong>${opts.trialDays} day${opts.trialDays === 1 ? "" : "s"} of Premium</strong> —
           every test, the full mock, and the AI tutor that explains any question you get wrong.
         </p>`
      : "";

  return {
    subject: "Welcome to SATway — your first test takes 35 minutes",
    text:
      `Hi ${name}, welcome to SATway.\n\n` +
      `Start with one module: about 35 minutes, and you get a real 200-800 section score.\n\n` +
      `SATway is adaptive like the real Digital SAT — how you do in Module 1 decides which Module 2 you get.\n\n` +
      `Take your first test: ${url}`,
    html: `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <div style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:24px">
      SAT<span style="background:#2563eb;color:#fff;border-radius:6px;padding:2px 6px">way</span>
    </div>
    <h1 style="font-size:18px;color:#0f172a;margin:0 0 8px">Welcome, ${name}</h1>
    <p style="font-size:14px;color:#475569;margin:0 0 20px">
      Start with one module: about 35 minutes, and you get a real 200–800 section score at the end —
      not a guess. SATway is adaptive like the real Digital SAT, so how you do in Module 1 decides
      which Module 2 you get.
    </p>
    ${trial}
    <a href="${url}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:600">
      Take your first test
    </a>
    <p style="font-size:13px;color:#94a3b8;margin:24px 0 0">
      You can turn these emails off any time in your profile.
    </p>
  </div>`,
  };
}

export function passwordResetEmail(code: string): { subject: string; html: string; text: string } {
  return {
    subject: `${code} is your satway password reset code`,
    text: `Your satway password reset code is ${code}. It expires in 10 minutes. If you didn't request a reset, you can ignore this email.`,
    html: `
  <div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <div style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:24px">
      SAT<span style="background:#2563eb;color:#fff;border-radius:6px;padding:2px 6px">way</span>
    </div>
    <h1 style="font-size:18px;color:#0f172a;margin:0 0 8px">Reset your password</h1>
    <p style="font-size:14px;color:#475569;margin:0 0 20px">
      Use the code below to set a new password for your satway account.
    </p>
    <div style="font-size:34px;font-weight:800;letter-spacing:10px;color:#2563eb;background:#eff6ff;border-radius:12px;padding:18px;text-align:center">
      ${code}
    </div>
    <p style="font-size:13px;color:#94a3b8;margin:20px 0 0">
      This code expires in 10 minutes. If you didn't request a password reset, you can safely ignore this email — your password won't change.
    </p>
  </div>`,
  };
}
