import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

/**
 * Shared bearer auth for every /api/cron/* endpoint.
 *
 * Header-only, deliberately. A `?key=<secret>` query param is convenient and lands the
 * secret in the nginx access log, the Referer header of any outbound link, and the
 * browser history of whoever tests it by pasting the URL. If a cron runner cannot set a
 * header, use `curl -H` from a shell script rather than weakening this.
 *
 * Returns null when the caller is authorised; otherwise the response to send back.
 */
export function requireCron(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // 503, not 401: the endpoint is not protected because it is not configured, and a
    // 401 here would look like a caller problem while the real fault is the deploy.
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }

  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const sb = Buffer.from(secret);
  const pb = Buffer.from(bearer);
  // Length check first: timingSafeEqual THROWS on a length mismatch rather than
  // returning false, which would surface as a 500 instead of a 401.
  if (pb.length !== sb.length || !crypto.timingSafeEqual(pb, sb)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
