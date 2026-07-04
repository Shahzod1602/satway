import type { MetadataRoute } from "next";

// PWA manifest — makes SATway installable on phones (the primary device in the
// target market) and gives it an app-like standalone window.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SATway — Digital SAT practice",
    short_name: "SATway",
    description:
      "Full-length adaptive Digital SAT practice with automatic scoring and an AI tutor.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#2563eb",
    orientation: "portrait",
    categories: ["education"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
