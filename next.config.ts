import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

// Content-Security-Policy. 'unsafe-inline' is required for Next's inline
// runtime/styles; tighten with nonces later if needed.
//
// Desmos powers the in-exam Math calculator (same engine as the real Digital SAT). Its
// loader script pulls from www.desmos.com, but once instantiated the calculator also
// fetches styles, fonts, images, and worker blobs from *.desmos.com and the Desmos S3
// bucket (desmos.s3.amazonaws.com). Every one of those needs to be allow-listed or the
// calculator renders blank / broken — see https://www.desmos.com/api.
const DESMOS = "https://www.desmos.com https://*.desmos.com https://desmos.s3.amazonaws.com";
// Telegram Login Widget: loads its script from telegram.org and embeds an
// oauth.telegram.org iframe; user avatars are served from t.me.
const TG_SCRIPT = "https://telegram.org";
const TG_FRAME = "https://oauth.telegram.org";
const TG_IMG = "https://t.me";
const csp = [
  "default-src 'self'",
  // 'unsafe-eval' is required by Telegram's widget script (it evals internally)
  // and by Next's dev runtime. Acceptable here since 'unsafe-inline' is already
  // allowed for scripts, so eval doesn't materially change the posture.
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${DESMOS} ${TG_SCRIPT}`,
  // Desmos injects its own inline + hosted stylesheets from www.desmos.com.
  `style-src 'self' 'unsafe-inline' ${DESMOS}`,
  `img-src 'self' data: blob: ${DESMOS} ${TG_IMG}`,
  // Desmos serves its math/UI fonts from *.desmos.com.
  `font-src 'self' data: ${DESMOS}`,
  `connect-src 'self' ${DESMOS} ${TG_FRAME}`,
  // Desmos may render inside an iframe on some browsers; allow its origin.
  `frame-src 'self' ${DESMOS} ${TG_FRAME}`,
  // Desmos spawns a blob: web worker for background computation.
  "worker-src 'self' blob:",
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
