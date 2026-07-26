// Payme Merchant API end-to-end drill against the local dev server.
// Plays Payme's role: drives the JSON-RPC state machine and checks every branch that
// involves money, including the sandbox's pickiest cases. Cleans up after itself.
import "dotenv/config";
import { prisma } from "./src/lib/prisma";
import bcrypt from "bcryptjs";

const BASE = "http://localhost:3111";
const KEY = process.env.PAYME_KEY!;

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  ok ? pass++ : fail++;
};

async function rpc(method: string, params: Record<string, unknown>, key = KEY) {
  const res = await fetch(`${BASE}/api/webhooks/payme`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`Paycom:${key}`).toString("base64")}`,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: Math.floor(Math.random() * 1e6), method, params }),
  });
  if (res.status !== 200) throw new Error(`HTTP ${res.status} — Payme reads non-200 as -32400`);
  return res.json();
}

async function main() {
  // ── Fixtures ──
  const pw = await bcrypt.hash("x", 4);
  const owner = await prisma.user.create({
    data: { name: "Payme Owner", email: `pmowner-${Date.now()}@t.local`, password: pw, emailVerified: true, emailNotifications: false },
  });
  const buyer = await prisma.user.create({
    data: { name: "Payme Buyer", email: `pmbuyer-${Date.now()}@t.local`, password: pw, emailVerified: true, emailNotifications: false },
  });
  await prisma.promoCode.create({
    data: { code: "PAYMEE2E", percentOff: 25, ownerId: owner.id, commissionPct: 50 },
  });

  // ── 1. Checkout link ──
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const cookie0 = (csrfRes.headers.get("set-cookie") ?? "").split(";")[0];
  const csrf = (await csrfRes.json()).csrfToken;
  const login = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: cookie0 },
    body: new URLSearchParams({ csrfToken: csrf, email: buyer.email, password: "x", json: "true" }),
    redirect: "manual",
  });
  const cookies = [cookie0, ...(login.headers.getSetCookie?.() ?? [])]
    .map((c) => c.split(";")[0])
    .join("; ");
  const co = await (await fetch(`${BASE}/api/payment/payme`, {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: cookies },
    body: JSON.stringify({ planId: "3m", promoCode: "PAYMEE2E" }),
  })).json();
  check("checkout returns a checkout.paycom.uz URL", String(co.url).startsWith("https://checkout.paycom.uz/"));
  const blob = Buffer.from(String(co.url).split("/").pop()!, "base64").toString("utf8");
  check("blob carries the amount in TIYIN (60,000 so'm → 6,000,000)", blob.includes("a=6000000"), blob);
  const orderNo = Number(/ac\.order_id=(\d+)/.exec(blob)?.[1]);
  check("blob carries ac.order_id", Number.isSafeInteger(orderNo) && orderNo > 0, `order=${orderNo}`);

  const TIYIN = 6_000_000;
  const account = { order_id: String(orderNo) };
  const TX = `e2e-tx-${Date.now()}`;

  // ── 2. Auth ──
  const badAuth = await rpc("CheckPerformTransaction", { amount: TIYIN, account }, "wrong-key");
  check("wrong Basic key → -32504 (and HTTP 200)", badAuth.error?.code === -32504);

  // ── 3. CheckPerformTransaction ──
  check("unknown order → -31050 with data=order_id",
    (await rpc("CheckPerformTransaction", { amount: TIYIN, account: { order_id: "999999999" } })).error?.code === -31050);
  check("wrong amount → -31001",
    (await rpc("CheckPerformTransaction", { amount: 123, account })).error?.code === -31001);
  check("valid check → allow:true",
    (await rpc("CheckPerformTransaction", { amount: TIYIN, account })).result?.allow === true);

  // ── 4. CreateTransaction ──
  const created = await rpc("CreateTransaction", { id: TX, time: Date.now(), amount: TIYIN, account });
  check("create → state 1", created.result?.state === 1, `create_time=${created.result?.create_time}`);
  const createTime = created.result?.create_time;

  const createdAgain = await rpc("CreateTransaction", { id: TX, time: Date.now(), amount: TIYIN, account });
  check("create retry → SAME create_time, state 1",
    createdAgain.result?.state === 1 && createdAgain.result?.create_time === createTime);

  check("a SECOND transaction on the held order → -31051 (account range, not -31008)",
    (await rpc("CreateTransaction", { id: `${TX}-other`, time: Date.now(), amount: TIYIN, account })).error?.code === -31051);

  // ── 5. PerformTransaction ──
  const performed = await rpc("PerformTransaction", { id: TX });
  check("perform → state 2", performed.result?.state === 2);
  const performTime = performed.result?.perform_time;

  const afterPay = await prisma.user.findUnique({ where: { id: buyer.id }, select: { plan: true, premiumUntil: true } });
  check("buyer got ~3 months of Premium",
    afterPay?.plan === "PREMIUM" && !!afterPay?.premiumUntil && afterPay.premiumUntil.getTime() > Date.now() + 85 * 86400e3,
    `until=${afterPay?.premiumUntil?.toISOString().slice(0, 10)}`);

  const payRow = await prisma.payment.findUnique({ where: { orderNo } });
  check("payment row: APPROVED + providerRef + paymeState 2",
    payRow?.status === "APPROVED" && payRow?.providerRef === `payme:${TX}` && payRow?.paymeState === 2);
  check("commission snapshot intact (50% of 60,000 = 30,000)",
    payRow?.promoOwnerId === owner.id && Math.round(payRow!.amount * payRow!.commissionPct / 100) === 30000);

  const untilBefore = afterPay!.premiumUntil!.getTime();
  const performAgain = await rpc("PerformTransaction", { id: TX });
  const afterRetry = await prisma.user.findUnique({ where: { id: buyer.id }, select: { premiumUntil: true } });
  check("perform retry → SAME perform_time, no double grant",
    performAgain.result?.perform_time === performTime && afterRetry!.premiumUntil!.getTime() === untilBefore);

  // ── 6. CheckTransaction ──
  const checked = await rpc("CheckTransaction", { id: TX });
  check("check → full tx view (state 2, times consistent)",
    checked.result?.state === 2 && checked.result?.perform_time === performTime && checked.result?.create_time === createTime);
  check("unknown tx → -31003", (await rpc("CheckTransaction", { id: "no-such-tx" })).error?.code === -31003);

  // ── 7. Cancel after perform = refund ──
  const cancelled = await rpc("CancelTransaction", { id: TX, reason: 5 });
  check("cancel after perform → state -2", cancelled.result?.state === -2);
  const refunded = await prisma.payment.findUnique({ where: { orderNo }, select: { status: true, paymeCancelReason: true } });
  check("row flips to REFUNDED with the reason recorded",
    refunded?.status === "REFUNDED" && refunded?.paymeCancelReason === 5);
  const cancelAgain = await rpc("CancelTransaction", { id: TX, reason: 5 });
  check("cancel retry → SAME cancel_time",
    cancelAgain.result?.cancel_time === cancelled.result?.cancel_time && cancelAgain.result?.state === -2);

  // ── 8. Timeout: a transaction held >12h must expire, not perform ──
  const stale = await prisma.payment.create({
    data: {
      userId: buyer.id, provider: "payme", planLabel: "1m", months: 1, amount: 30000,
      baseAmount: 30000, status: "PENDING", paymeTransId: `${TX}-stale`, paymeState: 1,
      paymeCreatedAt: new Date(Date.now() - 13 * 3600e3),
    },
  });
  const late = await rpc("PerformTransaction", { id: `${TX}-stale` });
  const staleRow = await prisma.payment.findUnique({ where: { id: stale.id }, select: { status: true, paymeCancelReason: true } });
  check("12h-stale perform → -31008 and the order expires with reason 4",
    late.error?.code === -31008 && staleRow?.status === "CANCELLED" && staleRow?.paymeCancelReason === 4);

  // ── 9. GetStatement — the range filter must both include and exclude ──
  const narrow = await rpc("GetStatement", { from: Date.now() - 3600e3, to: Date.now() });
  check("1h statement window sees only the fresh transaction (stale one is 13h old)",
    Array.isArray(narrow.result?.transactions) && narrow.result.transactions.length === 1 &&
    narrow.result.transactions[0].id === TX);
  const wide = await rpc("GetStatement", { from: Date.now() - 14 * 3600e3, to: Date.now() });
  check("14h statement window sees both",
    Array.isArray(wide.result?.transactions) && wide.result.transactions.length === 2);

  // ── cleanup ──
  await prisma.payment.deleteMany({ where: { userId: buyer.id } });
  await prisma.promoCode.deleteMany({ where: { code: "PAYMEE2E" } });
  await prisma.event.deleteMany({ where: { userId: { in: [buyer.id, owner.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [buyer.id, owner.id] } } });
  console.log(`\n${pass} passed, ${fail} failed — fixtures removed`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
