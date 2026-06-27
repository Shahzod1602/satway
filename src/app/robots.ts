import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Keep authenticated / private areas out of the index.
        disallow: ["/api/", "/admin", "/dashboard", "/home", "/profile", "/results", "/test", "/progress"],
      },
    ],
    sitemap: "https://satway.online/sitemap.xml",
    host: "https://satway.online",
  };
}
