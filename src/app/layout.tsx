import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz"],
});

const SITE_URL = "https://satway.online";
const SITE_DESC =
  "SAT exam preparation: full-length adaptive Digital SAT Reading & Writing and Math practice tests with automatic 200–800 scaled scoring.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "SATway — Digital SAT practice", template: "%s — SATway" },
  description: SITE_DESC,
  applicationName: "SATway",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "SATway",
    title: "SATway — Digital SAT practice",
    description: SITE_DESC,
  },
  twitter: {
    card: "summary_large_image",
    title: "SATway — Digital SAT practice",
    description: SITE_DESC,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
