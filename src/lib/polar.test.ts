import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyPolarSignature } from "./polar";

// Standard Webhooks: base64 HMAC-SHA256 over "<id>.<timestamp>.<rawBody>", keyed with
// the RAW UTF-8 bytes of the secret (not base64-decoded). These tests pin exactly the
// scheme Polar sends, so a refactor that "cleans up" the keying breaks loudly here
// instead of silently rejecting every real delivery.

const SECRET = "polar_whs_test_secret";

function sign(body: string, opts: { id?: string; ts?: number; secret?: string } = {}) {
  const id = opts.id ?? "msg_test_1";
  const ts = opts.ts ?? Math.floor(Date.now() / 1000);
  const sig = crypto
    .createHmac("sha256", Buffer.from(opts.secret ?? SECRET, "utf8"))
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
  return { id, ts, sig };
}

function headersFor(body: string, opts: { id?: string; ts?: number; secret?: string; sigList?: string } = {}) {
  const { id, ts, sig } = sign(body, opts);
  return new Headers({
    "webhook-id": id,
    "webhook-timestamp": String(ts),
    "webhook-signature": opts.sigList ?? `v1,${sig}`,
  });
}

test("accepts a valid signature", () => {
  process.env.POLAR_WEBHOOK_SECRET = SECRET;
  const body = JSON.stringify({ type: "order.paid", data: { id: "o_1" } });
  assert.equal(verifyPolarSignature(body, headersFor(body)), true);
});

test("rejects a tampered body", () => {
  process.env.POLAR_WEBHOOK_SECRET = SECRET;
  const body = JSON.stringify({ type: "order.paid", data: { id: "o_1" } });
  const headers = headersFor(body);
  const tampered = body.replace("o_1", "o_2");
  assert.equal(verifyPolarSignature(tampered, headers), false);
});

test("rejects a stale timestamp (replay window is 5 minutes)", () => {
  process.env.POLAR_WEBHOOK_SECRET = SECRET;
  const body = "{}";
  const stale = Math.floor(Date.now() / 1000) - 10 * 60;
  assert.equal(verifyPolarSignature(body, headersFor(body, { ts: stale })), false);
});

test("accepts the matching signature anywhere in a rotated-secret list", () => {
  process.env.POLAR_WEBHOOK_SECRET = SECRET;
  const body = "{}";
  const good = sign(body);
  const bad = sign(body, { id: good.id, ts: good.ts, secret: "some_old_rotated_secret" });
  const headers = new Headers({
    "webhook-id": good.id,
    "webhook-timestamp": String(good.ts),
    "webhook-signature": `v1,${bad.sig} v1,${good.sig}`,
  });
  assert.equal(verifyPolarSignature(body, headers), true);
});

test("rejects everything when the secret env is missing", () => {
  process.env.POLAR_WEBHOOK_SECRET = SECRET;
  const body = "{}";
  const headers = headersFor(body);
  delete process.env.POLAR_WEBHOOK_SECRET;
  assert.equal(verifyPolarSignature(body, headers), false);
});
