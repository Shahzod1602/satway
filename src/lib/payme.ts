import crypto from "crypto";

// Payme (Paycom) Merchant API — local UZS payments with Uzcard/Humo/Visa via the
// Payme app or the hosted checkout. Docs: https://developer.help.paycom.uz
//
// Ported from the sister app's live integration (ieltsway, kassa active since
// 2026-07-16). Satway needs its OWN kassa in the same Payme cabinet — never share:
// the receipt shows the kassa's registered name, and out-of-profile transactions put
// the working kassa at risk.
//
// Flow: we redirect the buyer to checkout.paycom.uz with a base64 blob carrying the
// merchant id, the order (ac.order_id = our Payment.orderNo) and the amount in TIYIN.
// Payme then drives a state machine against ONE endpoint of ours
// (/api/webhooks/payme) over JSON-RPC 2.0:
//   CheckPerformTransaction — may this order be paid, for this amount?
//   CreateTransaction       — hold it (state 1)
//   PerformTransaction      — money moved (state 2) → grant Premium
//   CancelTransaction       — state -1 (before perform) or -2 (refund after)
//   CheckTransaction        — read back whatever we recorded
//   GetStatement            — reconciliation over a time range
// Payme authenticates with HTTP Basic, login "Paycom", password = the merchant key
// from the cabinet. Every response MUST be HTTP 200 — a non-200 is read as RPC error
// -32400 and the transaction is retried.

export function paymeConfigured(): boolean {
  return Boolean(process.env.PAYME_MERCHANT_ID && process.env.PAYME_KEY);
}

/** The account field registered in the Payme cabinet — Payme sends it back as `account.order_id`. */
export const PAYME_ACCOUNT_FIELD = "order_id";

/**
 * Hosted checkout URL for a pending Payment row. `a` is in TIYIN (UZS × 100) and
 * `ac.order_id` must match the account field configured in the Payme cabinet.
 */
export function buildPaymeCheckoutUrl(input: {
  amountUzs: number;
  orderNo: number;
  returnUrl: string;
}): string {
  const params = [
    `m=${process.env.PAYME_MERCHANT_ID}`,
    `ac.${PAYME_ACCOUNT_FIELD}=${input.orderNo}`,
    `a=${input.amountUzs * 100}`, // tiyin
    `c=${input.returnUrl}`,
    "l=en",
  ].join(";");
  return `https://checkout.paycom.uz/${Buffer.from(params, "utf8").toString("base64")}`;
}

/**
 * Payme signs nothing — it authenticates with Basic auth, login "Paycom",
 * password = PAYME_KEY. Compare in constant time; a mismatch is -32504.
 */
export function verifyPaymeAuth(header: string | null): boolean {
  if (!header?.startsWith("Basic ")) return false;
  // PAYME_TEST_KEY exists ONLY during onboarding: the sandbox (test.paycom.uz) signs
  // with the test key while the live checkout signs with the production one, and both
  // have to be accepted at the same time to get the kassa activated. Unset it the
  // moment the kassa goes live — until then it is a second password to the endpoint
  // that grants Premium.
  const keys = [process.env.PAYME_KEY, process.env.PAYME_TEST_KEY].filter(Boolean);
  const got = Buffer.from(header.slice(6).trim(), "utf8");
  return keys.some((key) => {
    const expected = Buffer.from(Buffer.from(`Paycom:${key}`, "utf8").toString("base64"), "utf8");
    return got.length === expected.length && crypto.timingSafeEqual(got, expected);
  });
}

/** Transaction states, as Payme models them. */
export const PAYME_STATE = {
  CREATED: 1,
  PERFORMED: 2,
  CANCELLED: -1, // cancelled before the money moved
  CANCELLED_AFTER_PERFORM: -2, // refunded
} as const;

/**
 * Payme error codes. -31050…-31099 is the range reserved for "the buyer typed a bad
 * account" — we use the top of it for an unknown/unpayable order, and the `data`
 * field must name the offending account field.
 */
export const PAYME_ERR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  UNAUTHORIZED: -32504,
  WRONG_AMOUNT: -31001,
  TX_NOT_FOUND: -31003,
  CANT_CANCEL: -31007, // service already fully delivered
  CANT_PERFORM: -31008, // state machine forbids it
  ORDER_NOT_FOUND: -31050, // account.order_id doesn't resolve
  ORDER_NOT_PAYABLE: -31051, // it resolves, but it isn't awaiting payment
} as const;

type Msg = { ru: string; uz: string; en: string };

const MESSAGES: Record<number, Msg> = {
  [PAYME_ERR.PARSE]: { ru: "Ошибка разбора JSON", uz: "JSON tahlil xatosi", en: "JSON parse error" },
  [PAYME_ERR.INVALID_REQUEST]: { ru: "Неверный запрос", uz: "Noto'g'ri so'rov", en: "Invalid request" },
  [PAYME_ERR.METHOD_NOT_FOUND]: { ru: "Метод не найден", uz: "Metod topilmadi", en: "Method not found" },
  [PAYME_ERR.UNAUTHORIZED]: { ru: "Недостаточно привилегий", uz: "Huquqlar yetarli emas", en: "Insufficient privileges" },
  [PAYME_ERR.WRONG_AMOUNT]: { ru: "Неверная сумма", uz: "Noto'g'ri summa", en: "Incorrect amount" },
  [PAYME_ERR.TX_NOT_FOUND]: { ru: "Транзакция не найдена", uz: "Tranzaksiya topilmadi", en: "Transaction not found" },
  [PAYME_ERR.CANT_CANCEL]: {
    ru: "Заказ выполнен. Невозможно отменить транзакцию.",
    uz: "Buyurtma bajarilgan. Tranzaksiyani bekor qilib bo'lmaydi.",
    en: "Order completed. The transaction cannot be cancelled.",
  },
  [PAYME_ERR.CANT_PERFORM]: {
    ru: "Невозможно выполнить операцию",
    uz: "Operatsiyani bajarib bo'lmaydi",
    en: "Unable to perform the operation",
  },
  [PAYME_ERR.ORDER_NOT_FOUND]: { ru: "Заказ не найден", uz: "Buyurtma topilmadi", en: "Order not found" },
  [PAYME_ERR.ORDER_NOT_PAYABLE]: {
    ru: "Заказ не ожидает оплаты",
    uz: "Buyurtma to'lovni kutmayapti",
    en: "This order is not awaiting payment",
  },
};

/** JSON-RPC error envelope. Payme reads `data` as the name of the bad account field. */
export function paymeError(id: unknown, code: number, data?: string) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: {
      code,
      message: MESSAGES[code] ?? MESSAGES[PAYME_ERR.CANT_PERFORM],
      ...(data ? { data } : {}),
    },
  };
}

/** JSON-RPC success envelope. */
export function paymeResult(id: unknown, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

/** Payme cancels an unpaid transaction it has held for 12 hours (reason 4). */
export const PAYME_TIMEOUT_MS = 12 * 60 * 60 * 1000;

/** Payme timestamps are epoch milliseconds; absent times are 0, never null. */
export const ms = (d: Date | null | undefined): number => (d ? d.getTime() : 0);
