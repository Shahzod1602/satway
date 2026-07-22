import crypto from "crypto";

// Click.uz (SHOP-API) — local UZS payments with Uzcard/Humo, via the Click app or any
// card without registration. Docs: https://docs.click.uz
//
// Ported from the sister app's battle-tested integration (ieltsway, service 107064,
// live since 2026-07-07). Satway needs its OWN service id in the same Click cabinet —
// never share the kassa: the receipt shows the registered service's name, and
// out-of-profile transactions put the working kassa at risk.
//
// Flow: we redirect the user to my.click.uz with amount + transaction_param (our
// orderNo). Click then calls our two registered endpoints:
//   Prepare  (action=0) → validate order + amount, issue merchant_prepare_id
//   Complete (action=1) → verify + grant Premium
// Both are signed: sign_string = md5 of the concatenated fields + SECRET_KEY.

export function clickConfigured(): boolean {
  return Boolean(
    process.env.CLICK_SERVICE_ID &&
      process.env.CLICK_MERCHANT_ID &&
      process.env.CLICK_SECRET_KEY,
  );
}

/** Hosted payment page URL for a pending Payment row. */
export function buildClickPayUrl(input: {
  amountUzs: number;
  orderNo: number;
  returnUrl: string;
}): string {
  const p = new URLSearchParams({
    service_id: String(process.env.CLICK_SERVICE_ID),
    merchant_id: String(process.env.CLICK_MERCHANT_ID),
    amount: String(input.amountUzs),
    // The short order number also reads much nicer than a cuid on Click's
    // order-number line; the webhooks resolve it back to the row.
    transaction_param: String(input.orderNo),
    return_url: input.returnUrl,
  });
  return `https://my.click.uz/services/pay?${p.toString()}`;
}

export type ClickCallbackParams = {
  click_trans_id: string;
  service_id: string;
  merchant_trans_id: string; // our orderNo (transaction_param)
  merchant_prepare_id?: string; // present on Complete
  click_paydoc_id?: string; // Click's payment-document id — the "paydoc" support asks for
  amount: string; // e.g. "30000.00" — use VERBATIM in the sign string
  action: string; // "0" prepare | "1" complete
  error: string; // <0 = cancelled/failed on Click's side
  error_note?: string;
  sign_time: string;
  sign_string: string;
};

/**
 * Verify Click's md5 signature. The amount and ids must be the exact strings Click
 * sent — re-formatting them breaks the hash.
 *   action=0: md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + amount + action + sign_time)
 *   action=1: md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + merchant_prepare_id + amount + action + sign_time)
 */
export function verifyClickSign(p: ClickCallbackParams): boolean {
  const secret = process.env.CLICK_SECRET_KEY;
  if (!secret || !p.sign_string) return false;
  const prepareId = p.action === "1" ? (p.merchant_prepare_id ?? "") : "";
  const digest = crypto
    .createHash("md5")
    .update(
      `${p.click_trans_id}${p.service_id}${secret}${p.merchant_trans_id}${prepareId}${p.amount}${p.action}${p.sign_time}`,
    )
    .digest("hex");
  const a = Buffer.from(digest, "utf8");
  const b = Buffer.from(p.sign_string.toLowerCase(), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Standard Click SHOP-API error codes for our responses. */
export const CLICK_ERR = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INCORRECT_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  TRANSACTION_NOT_FOUND: -5,
  PREPARE_NOT_FOUND: -6,
  BAD_REQUEST: -8,
  TRANSACTION_CANCELLED: -9,
} as const;

/** Parse the x-www-form-urlencoded callback body into typed params. */
export async function parseClickCallback(req: Request): Promise<ClickCallbackParams | null> {
  try {
    const form = await req.formData();
    const get = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" ? v : "";
    };
    const p: ClickCallbackParams = {
      click_trans_id: get("click_trans_id"),
      service_id: get("service_id"),
      merchant_trans_id: get("merchant_trans_id"),
      merchant_prepare_id: get("merchant_prepare_id") || undefined,
      click_paydoc_id: get("click_paydoc_id") || undefined,
      amount: get("amount"),
      action: get("action"),
      error: get("error"),
      error_note: get("error_note") || undefined,
      sign_time: get("sign_time"),
      sign_string: get("sign_string"),
    };
    if (!p.click_trans_id || !p.service_id || !p.action || !p.sign_time) return null;
    return p;
  } catch {
    return null;
  }
}
