// Simple in-memory sliding-window rate limiter.
//
// NOTE: state lives in the process, so this protects a single instance only.
// When the app is scaled to multiple instances, swap the Map for Redis
// (e.g. @upstash/ratelimit) behind the same `rateLimit()` signature.

import { NextRequest } from "next/server";

type Hit = { count: number; resetAt: number };

const buckets = new Map<string, Hit>();

// Opportunistic cleanup so the Map doesn't grow unbounded.
function sweep(now: number) {
  if (buckets.size < 5000) return;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
};

/**
 * Allow `limit` requests per `windowMs` for a given key.
 * Returns ok=false once the limit is exceeded within the window.
 */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  hit.count += 1;
  if (hit.count > limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((hit.resetAt - now) / 1000) };
  }
  return { ok: true, remaining: limit - hit.count, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers, falling back to a constant. */
export function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
