import { NextResponse } from "next/server";
import { ZodError } from "zod";

/** Standard JSON error response. */
export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/** 429 with a Retry-After header. */
export function tooManyRequests(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

/**
 * Wrap a route handler so unexpected errors are logged server-side and the
 * client only ever sees a generic message — never a raw stack/Prisma string.
 * Zod validation errors are surfaced as a clean 400.
 */
export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof ZodError) {
        return jsonError("Invalid input.", 400, { issues: e.issues.map((i) => i.message) });
      }
      console.error("[api] unhandled error:", e);
      return jsonError("Something went wrong. Please try again.", 500);
    }
  };
}
