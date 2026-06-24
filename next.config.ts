import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy. 'unsafe-inline' is required for Next's inline
// runtime/styles; tighten with nonces later if needed.
// Desmos powers the in-exam Math calculator and pulls scripts/assets/data from
// its own domains, so those are allow-listed here.
const DESMOS = "https://www.desmos.com https://*.desmos.com";
// Telegram Login Widget: loads its script from telegram.org and embeds an
// oauth.telegram.org iframe; user avatars are served from t.me.
const TG_SCRIPT = "https://telegram.org";
const TG_FRAME = "https://oauth.telegram.org";
const TG_IMG = "https://t.me";
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' ${DESMOS} ${TG_SCRIPT}` + (isProd ? "" : " 'unsafe-eval'"),
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${DESMOS} ${TG_IMG}`,
  "font-src 'self' data:",
  `connect-src 'self' ${DESMOS} ${TG_FRAME}`,
  `frame-src 'self' ${TG_FRAME}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
