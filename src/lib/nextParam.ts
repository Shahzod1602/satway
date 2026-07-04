// Read a validated ?next= redirect target from the current URL (client-side).
// Only same-origin relative paths are allowed, to prevent open-redirects.
export function safeNext(fallback = "/dashboard"): string {
  if (typeof window === "undefined") return fallback;
  const next = new URLSearchParams(window.location.search).get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return fallback;
}
