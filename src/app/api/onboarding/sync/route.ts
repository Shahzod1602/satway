import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import {
  gateConfig,
  gateStatusForUser,
  GATE_COOKIE,
  GATE_COOKIE_MAX_AGE,
} from "@/lib/onboarding";

/**
 * Reconcile the gate cookie against the DB (the source of truth) and bounce the
 * user onward. The client hits this after clearing the gate, and the /welcome
 * page redirects here when its DB flags already show "passed" (e.g. a second
 * device whose cookie was never set). Setting the httpOnly cookie must happen
 * in a route handler — a Server Component can't set cookies during render.
 */
export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const user = await currentUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));

  const cfg = gateConfig();
  if (!cfg.enabled) return NextResponse.redirect(new URL("/home", origin));

  const status = await gateStatusForUser(cfg, user.id);
  if (!status.passed) return NextResponse.redirect(new URL("/welcome", origin));

  const res = NextResponse.redirect(new URL("/home", origin));
  res.cookies.set(GATE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: GATE_COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
