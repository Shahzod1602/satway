// Click SHOP-API end-to-end drill against the local dev server.
// Plays Click's role: forges correctly-signed Prepare/Complete callbacks and checks
// every branch that involves money. Cleans up after itself.
import "dotenv/config";
import crypto from "crypto";
import { prisma } from "./src/lib/prisma";
import bcrypt from "bcryptjs";

const BASE = "http://localhost:3111";
const SECRET = process.env.CLICK_SECRET_KEY!;
const SERVICE = process.env.CLICK_SERVICE_ID!;

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

function sign(p: Record<string, string>, action: "0" | "1", prepareId = "") {
  const s = `${p.click_trans_id}${SERVICE}${SECRET}${p.merchant_trans_id}${action === "1" ? prepareId : ""}${p.amount}${action}${p.sign_time}`;
  return crypto.createHash("md5").update(s).digest("hex");
}

async function callback(
  path: "prepare" | "complete",
  p: Record<string, string>,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE}/api/webhooks/click/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(p).toString(),
  });
  return res.json();
}

const baseParams = (orderNo: number, amount: string, action: "0" | "1", transId: string) => ({
  click_trans_id: transId,
  service_id: SERVICE,
  merchant_trans_id: String(orderNo),
  amount,
  action,
  error: "0",
  error_note: "Success",
  sign_time: "2026-07-17 12:00:00",
});

async function main() {
  // ── Fixtures: a referrer, a buyer referred by them, a promo code owned by a third user ──
  const pw = await bcrypt.hash("x", 4);
  const owner = await prisma.user.create({
    data: { name: "Code Owner", email: `owner-${Date.now()}@t.local`, password: pw, emailVerified: true, emailNotifications: false },
  });
  const referrer = await prisma.user.create({
    data: { name: "Referrer", email: `ref-${Date.now()}@t.local`, password: pw, emailVerified: true, referralCode: `T${Date.now() % 1e6}`, emailNotifications: false },
  });
  const buyer = await prisma.user.create({
    data: {
      name: "Click Buyer", email: `buyer-${Date.now()}@t.local`, password: pw,
      emailVerified: true, referredById: referrer.id, emailNotifications: false,
    },
  });
  await prisma.promoCode.create({
    data: { code: "CLICKE2E", percentOff: 25, ownerId: owner.id, commissionPct: 50 },
  });

  // ── 1. Checkout: server derives 3m 80,000 − 25% = 60,000, mints an order ──
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const cookie0 = (csrfRes.headers.get("set-cookie") ?? "").split(";")[0];
  const csrf = (await csrfRes.json()).csrfToken;
  const login = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookie0 },
    body: new URLSearchParams({ csrfToken: csrf, email: buyer.email, password: "x", json: "true" }),
    redirect: "manual",
  });
  // bcrypt hash of "x" with cost 4 — login uses the real credential flow
  const cookies = [cookie0, ...(login.headers.getSetCookie?.() ?? [])]
    .map((c) => c.split(";")[0])
    .join("; ");
  const co = await fetch(`${BASE}/api/payment/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookies },
    body: JSON.stringify({ planId: "3m", promoCode: "CLICKE2E" }),
  });
  const coData = await co.json();
  check("checkout returns a my.click.uz URL", co.ok && String(coData.url).startsWith("https://my.click.uz/services/pay?"));
  const url = new URL(coData.url);
  check("checkout amount is the SERVER's 60,000 (25% off 80,000)", url.searchParams.get("amount") === "60000");
  const orderNo = Number(url.searchParams.get("transaction_param"));
  check("transaction_param is the orderNo", Number.isSafeInteger(orderNo) && orderNo > 0, `order=${orderNo}`);

  // Reuse: a second click must NOT mint a second order.
  const co2 = await (await fetch(`${BASE}/api/payment/click`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookies },
    body: JSON.stringify({ planId: "3m", promoCode: "CLICKE2E" }),
  })).json();
  check("re-click reuses the same order", new URL(co2.url).searchParams.get("transaction_param") === String(orderNo));

  // ── 2. Prepare ──
  const badSign = await callback("prepare", { ...baseParams(orderNo, "60000.00", "0", "111"), sign_string: "deadbeef" });
  check("prepare rejects a bad signature (-1)", badSign.error === -1);

  const wrongAmount = { ...baseParams(orderNo, "1000.00", "0", "111") } as Record<string, string>;
  wrongAmount.sign_string = sign(wrongAmount, "0");
  check("prepare rejects a wrong amount (-2)", (await callback("prepare", wrongAmount)).error === -2);

  const ghost = { ...baseParams(99999999, "60000.00", "0", "111") } as Record<string, string>;
  ghost.sign_string = sign(ghost, "0");
  check("prepare rejects an unknown order (-5)", (await callback("prepare", ghost)).error === -5);

  const prep = { ...baseParams(orderNo, "60000.00", "0", "111") } as Record<string, string>;
  prep.sign_string = sign(prep, "0");
  const prepRes = await callback("prepare", prep);
  const prepareId = String(prepRes.merchant_prepare_id);
  check("prepare succeeds and issues a prepare id", prepRes.error === 0 && Number(prepareId) > 0);

  const prepAgain = await callback("prepare", prep);
  check("prepare retry reuses the SAME prepare id", String(prepAgain.merchant_prepare_id) === prepareId);

  // ── 3. Complete ──
  const badPrep = { ...baseParams(orderNo, "60000.00", "1", "222"), merchant_prepare_id: "12345" } as Record<string, string>;
  badPrep.sign_string = sign(badPrep, "1", "12345");
  check("complete rejects a wrong prepare id (-6)", (await callback("complete", badPrep)).error === -6);

  const good = { ...baseParams(orderNo, "60000.00", "1", "222"), merchant_prepare_id: prepareId } as Record<string, string>;
  good.sign_string = sign(good, "1", prepareId);
  const done = await callback("complete", good);
  check("complete succeeds", done.error === 0);

  const afterPay = await prisma.user.findUnique({ where: { id: buyer.id }, select: { plan: true, premiumUntil: true } });
  const months3 = afterPay?.premiumUntil && afterPay.premiumUntil.getTime() > Date.now() + 85 * 86400e3;
  check("buyer got ~3 months of Premium", afterPay?.plan === "PREMIUM" && !!months3,
    `until=${afterPay?.premiumUntil?.toISOString().slice(0, 10)}`);

  const payRow = await prisma.payment.findUnique({ where: { orderNo } });
  check("payment row: APPROVED + providerRef + paidAt", payRow?.status === "APPROVED" && payRow?.providerRef === "click:222" && !!payRow?.paidAt);
  check("commission snapshot intact (50% of 60,000 = 30,000)",
    payRow?.promoOwnerId === owner.id && payRow?.commissionPct === 50 &&
    Math.round(payRow!.amount * payRow!.commissionPct / 100) === 30000);

  const refAfter = await prisma.user.findUnique({ where: { id: referrer.id }, select: { premiumUntil: true } });
  check("referrer earned +1 week", !!refAfter?.premiumUntil && refAfter.premiumUntil.getTime() > Date.now() + 6 * 86400e3);

  // Retry must be a no-op — no double grant.
  const untilBefore = afterPay!.premiumUntil!.getTime();
  const retry = await callback("complete", good);
  const afterRetry = await prisma.user.findUnique({ where: { id: buyer.id }, select: { premiumUntil: true } });
  check("complete retry answers Already paid (-4) and does NOT double-grant",
    retry.error === -4 && afterRetry!.premiumUntil!.getTime() === untilBefore);

  // ── 4. Reversal after payment ──
  const rev = { ...baseParams(orderNo, "60000.00", "1", "222"), merchant_prepare_id: prepareId, error: "-5017" } as Record<string, string>;
  rev.sign_string = sign(rev, "1", prepareId);
  const revRes = await callback("complete", rev);
  const revRow = await prisma.payment.findUnique({ where: { orderNo }, select: { status: true } });
  check("reversal flips APPROVED → REFUNDED (human review flag)", revRes.error === -9 && revRow?.status === "REFUNDED");

  // ── cleanup ──
  await prisma.payment.deleteMany({ where: { userId: buyer.id } });
  await prisma.promoCode.deleteMany({ where: { code: "CLICKE2E" } });
  await prisma.event.deleteMany({ where: { userId: { in: [buyer.id, owner.id, referrer.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [buyer.id, owner.id, referrer.id] } } });
  console.log(`\n${pass} passed, ${fail} failed — fixtures removed`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
