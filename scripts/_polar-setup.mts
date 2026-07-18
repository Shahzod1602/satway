/**
 * One-off Polar (polar.sh) store setup for SATway. Run it against the account the
 * env token belongs to — sandbox and production are separate Polar accounts with
 * separate tokens and separate product ids:
 *
 *   POLAR_SERVER=production \
 *   POLAR_ACCESS_TOKEN=polar_oat_… \
 *   APP_URL=https://satway.online \
 *   npx tsx scripts/_polar-setup.mts
 *
 * It is idempotent: products are matched by name and reused, and an existing webhook
 * for the same URL is left alone. It prints the POLAR_PRODUCTS and
 * POLAR_WEBHOOK_SECRET values to paste into the environment.
 *
 * The prices created here are placeholders — every checkout attaches its own ad-hoc
 * price (src/lib/polar.ts), which is what makes promo codes work — but a Polar
 * product must be born with one, and the catalog price is what a buyer would see if
 * they ever reached the product page directly.
 */
import crypto from "crypto";
import { PREMIUM_PLANS } from "../src/lib/plans.js";

const server = process.env.POLAR_SERVER;
const token = process.env.POLAR_ACCESS_TOKEN;
const appUrl = (process.env.APP_URL || "https://satway.online").replace(/\/+$/, "");

if (server !== "sandbox" && server !== "production") {
  throw new Error('POLAR_SERVER must be "sandbox" or "production"');
}
if (!token) throw new Error("POLAR_ACCESS_TOKEN is required");

const API = server === "production" ? "https://api.polar.sh" : "https://sandbox-api.polar.sh";

async function polar<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}\n${body}`);
  return (body ? JSON.parse(body) : null) as T;
}

type Product = { id: string; name: string; is_archived?: boolean };
type Paged<T> = { items: T[] };

/** One product per plan: Polar takes the checkout's title from the product. */
const WANTED: Array<{ planId: string; name: string; description: string; priceCents: number }> =
  PREMIUM_PLANS.map((p) => ({
    planId: p.id,
    name: `SATway Premium — ${p.label}`,
    description: `Full Premium access to SATway (all adaptive SAT mock tests, review & mistake bank, AI tutor) for ${p.label.toLowerCase()}.`,
    priceCents: p.totalUsd,
  }));

const existing = await polar<Paged<Product>>("/v1/products/?limit=100");
const byName = new Map(existing.items.filter((p) => !p.is_archived).map((p) => [p.name, p]));

const productIds: Record<string, string> = {};
for (const want of WANTED) {
  const found = byName.get(want.name);
  if (found) {
    console.log(`· reuse   ${want.planId.padEnd(4)} ${found.id}  ${want.name}`);
    productIds[want.planId] = found.id;
    continue;
  }
  const created = await polar<Product>("/v1/products/", {
    method: "POST",
    body: JSON.stringify({
      name: want.name,
      description: want.description,
      recurring_interval: null, // one-time purchase, not a subscription
      prices: [{ amount_type: "fixed", price_amount: want.priceCents, price_currency: "usd" }],
    }),
  });
  console.log(`+ created ${want.planId.padEnd(4)} ${created.id}  ${want.name}`);
  productIds[want.planId] = created.id;
}

// ── Webhook ──────────────────────────────────────────────────────────────────
type Endpoint = { id: string; url: string };
const hookUrl = `${appUrl}/api/webhooks/polar`;
const endpoints = await polar<Paged<Endpoint>>("/v1/webhooks/endpoints?limit=100");
const already = endpoints.items.find((e) => e.url === hookUrl);

let secret = "";
if (already) {
  console.log(`\n· webhook already exists for ${hookUrl} (${already.id})`);
  console.log("  Its secret can't be read back — reuse the POLAR_WEBHOOK_SECRET you stored,");
  console.log("  or delete the endpoint in the dashboard and re-run this script.");
} else {
  secret = crypto.randomBytes(32).toString("base64url");
  const created = await polar<Endpoint>("/v1/webhooks/endpoints", {
    method: "POST",
    body: JSON.stringify({
      url: hookUrl,
      format: "raw",
      secret,
      // order.paid is the only event that proves the money settled; order.created
      // can still be pending. order.refunded covers Polar's own pre-emptive refunds.
      events: ["order.paid", "order.refunded"],
    }),
  });
  console.log(`\n+ webhook created → ${hookUrl} (${created.id})`);
}

console.log("\n── env ─────────────────────────────────────────────");
console.log(`POLAR_SERVER=${server}`);
console.log(`POLAR_PRODUCTS=${JSON.stringify(productIds)}`);
if (secret) console.log(`POLAR_WEBHOOK_SECRET=${secret}`);
console.log("────────────────────────────────────────────────────");
