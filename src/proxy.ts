import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Kept in sync with GATE_COOKIE in lib/onboarding.ts (can't import Node modules
// into the Edge proxy bundle, so the literal is duplicated here).
const GATE_COOKIE = "sat_gate";

// Paths that must stay reachable without clearing the gate.
const PUBLIC_PREFIXES = [
  "/welcome",
  "/login",
  "/register",
  "/forgot-password",
  "/privacy",
  "/terms",
  "/offline",
];

function isPublicPath(pathname: string): boolean {
  if (pathname === "/") return true; // marketing landing
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(req: NextRequest) {
  // Opt-in: the gate only runs when a target is configured. Empty env = off.
  const gateEnabled =
    !!process.env.TELEGRAM_CHANNEL_ID ||
    !!process.env.INSTAGRAM_URL ||
    !!process.env.NEXT_PUBLIC_INSTAGRAM_URL;
  if (!gateEnabled) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  // Fast path — already cleared on this device/session.
  if (req.cookies.get(GATE_COOKIE)?.value === "1") return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) return NextResponse.next(); // not signed in — the page redirects to /login
  if ((token as { role?: string }).role === "ADMIN") return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/welcome";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on every page except API routes, Next internals, and static files
  // (anything with a file extension — sw.js, icons, manifest, etc.).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
