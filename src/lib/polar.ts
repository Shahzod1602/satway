import crypto from "crypto";

// Polar (polar.sh) — merchant of record for international Visa/Mastercard payments in
// USD. Polar has one product per plan, but the price charged is always an ad-hoc price
// attached to the checkout, so plans and promo discounts stay server-controlled here
// (src/lib/plans.ts + src/lib/checkout.ts), not in the Polar dashboard.
// Docs: https://polar.sh/docs/api-reference/checkouts/create-session
//
// POLAR_SERVER must be set explicitly. Sandbox and production are separate Polar
// accounts with separate tokens and separate product ids, and defaulting either way
// silently would be a money bug: production pointed at sandbox hands out Premium for a
// 4242-card "payment", sandbox pointed at production takes real money in a test flow.

type PolarServer = "sandbox" | "production";

function polarServer(): PolarServer | null {
  const s = process.env.POLAR_SERVER;
  return s === "sandbox" || s === "production" ? s : null;
}

function apiBase(server: PolarServer): string {
  return server === "production" ? "https://api.polar.sh" : "https://sandbox-api.polar.sh";
}

/**
 * planId → Polar product uuid, from POLAR_PRODUCTS (a JSON object). One product per
 * plan, because Polar takes the checkout's title from the product — a single shared
 * product would show every buyer "SATway Premium" with no plan on it, and would
 * flatten Polar's own sales reporting to one line.
 */
function productMap(): Record<string, string> {
  const raw = process.env.POLAR_PRODUCTS;
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, string> = {};
    for (const [planId, productId] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof productId === "string" && productId) out[planId] = productId;
    }
    return out;
  } catch {
    return {};
  }
}

export function polarConfigured(): boolean {
  return Boolean(
    polarServer() &&
      process.env.POLAR_ACCESS_TOKEN &&
      process.env.POLAR_WEBHOOK_SECRET &&
      Object.keys(productMap()).length > 0,
  );
}

type PolarError = { detail?: unknown };

function describeError(body: PolarError | null, status: number): string {
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const first = detail[0] as { msg?: unknown; loc?: unknown } | undefined;
    if (first && typeof first.msg === "string") {
      const where = Array.isArray(first.loc) ? ` (${first.loc.join(".")})` : "";
      return `${first.msg}${where}`;
    }
  }
  return `HTTP ${status}`;
}

/**
 * Create a hosted-checkout session. `custom` is sent as the checkout's metadata, which
 * Polar copies verbatim onto the resulting order — that's how the webhook matches a
 * paid order back to its Payment row.
 */
export async function createPolarCheckout(input: {
  planId: string;
  amountUsdCents: number;
  email: string | null; // prefill; skip synthetic @telegram.satway.online addresses
  clientIp: string | null;
  successUrl: string;
  custom: Record<string, string>;
}): Promise<{ ok: true; url: string; checkoutId: string } | { ok: false; error: string }> {
  const server = polarServer();
  const productId = productMap()[input.planId];
  if (!server || !process.env.POLAR_ACCESS_TOKEN) return { ok: false, error: "Polar is not configured" };
  if (!productId) return { ok: false, error: `No Polar product for plan "${input.planId}"` };

  const payload = {
    // Exactly one product. A multi-product session renders a picker, and the public
    // checkout-update endpoint would let the buyer switch to a cheaper one after we'd
    // already priced the session.
    products: [productId],
    // The custom-price mechanism — and it has to be an ad-hoc "fixed" price, not a
    // "custom" one: Polar's public (unauthenticated) checkout-update endpoint accepts
    // an `amount` from the browser and ignores it ONLY for fixed prices. A "custom"
    // (pay-what-you-want) price is buyer-editable.
    prices: {
      [productId]: [
        { amount_type: "fixed", price_amount: input.amountUsdCents, price_currency: "usd" },
      ],
    },
    // Promo discounts are already baked into price_amount; a Polar-side discount code
    // stacked on top would let buyers pay below the server-locked price.
    allow_discount_codes: false,
    ...(input.email ? { customer_email: input.email } : {}),
    // Polar geo-detects the buyer's tax jurisdiction from the IP of whoever calls this
    // endpoint — which is our server unless we forward the real one.
    ...(input.clientIp ? { customer_ip_address: input.clientIp } : {}),
    success_url: input.successUrl,
    metadata: input.custom,
    // Deliberately NOT setting external_customer_id: it locks the email field on the
    // checkout page, and Telegram-only accounts arrive here with no real address to
    // lock it to. The user id rides in `metadata` instead.
  };

  try {
    const res = await fetch(`${apiBase(server)}/v1/checkouts/`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.POLAR_ACCESS_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => null)) as ({ id?: string; url?: string } & PolarError) | null;
    if (!res.ok || !data?.url || !data?.id) {
      return { ok: false, error: describeError(data, res.status) };
    }
    return { ok: true, url: data.url, checkoutId: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Verify a webhook with the Standard Webhooks scheme (standardwebhooks.com):
 * base64 HMAC-SHA256 over "<id>.<timestamp>.<raw body>", keyed with the raw bytes of
 * the signing secret. The header holds a space-separated list of versioned signatures
 * ("v1,<sig> v1,<sig>") so a rotated secret can overlap.
 */
export function verifyPolarSignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.POLAR_WEBHOOK_SECRET;
  const id = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");
  if (!secret || !id || !timestamp || !signature) return false;

  // A valid signature stays valid forever, so an attacker who captures one delivery
  // could replay it indefinitely. Bound it to its timestamp.
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 5 * 60) return false;

  const expected = crypto
    .createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest("base64");
  const want = Buffer.from(expected, "utf8");

  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const got = Buffer.from(value, "utf8");
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  });
}

/**
 * Did the buyer actually pay at least the price we locked into the checkout?
 *
 * Compare `total_amount` — the charge — and NOT `net_amount`.
 *
 * Polar is the merchant of record and its default tax behaviour is location-based:
 * the US, Canada and India are priced tax-EXCLUSIVE (tax added on top of our price),
 * the rest of the world tax-INCLUSIVE (tax carved out of it). So an $8.75 checkout paid
 * under 20% VAT settles as net_amount 729 + tax_amount 146 = total_amount 875 — the
 * buyer paid in full, and net_amount sits below our price by exactly the local VAT rate.
 *
 * Comparing net_amount is what shipped first, and on the sister platform it withheld
 * Premium from two customers who HAD paid in full (GB 20%, KE 16%) before anyone
 * noticed: the guard was catching paying customers instead of cheap ones. total_amount
 * is >= the locked price under both behaviours, so a dashboard-level discount or an API
 * semantics change still cannot buy cheap Premium.
 *
 * Cents of a currency that isn't USD are not the cents our row is denominated in.
 */
export function paidEnough(
  // net_amount and tax_amount are listed to say plainly that they are SEEN and not used.
  order: { currency?: string; total_amount?: number; net_amount?: number; tax_amount?: number },
  expectedUsdCents: number | null,
): { ok: boolean; paid: number | null; currency: string } {
  const paid = typeof order.total_amount === "number" ? order.total_amount : null;
  const currency = (order.currency ?? "").toLowerCase();
  const ok =
    expectedUsdCents !== null && paid !== null && currency === "usd" && paid >= expectedUsdCents;
  return { ok, paid, currency };
}
