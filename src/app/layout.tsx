import type { Metadata } from "next";
import { JetBrains_Mono, Newsreader, Inter } from "next/font/google";
import "./globals.css";

import { Providers } from "@/components/providers";

// Editorial identity, applied app-wide: Inter (a neutral grotesque) for UI/body, and
// Newsreader (a transitional serif) for display headings via `font-serif`.
const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Threadline — the post-purchase text concierge",
    template: "%s",
  },
  description:
    "An open-source, SMS-first AI concierge that keeps a persistent text thread with every customer — answering questions before checkout and following up after delivery.",
  applicationName: "Threadline",
  keywords: [
    "post-purchase",
    "conversational commerce",
    "SMS concierge",
    "Shopify",
    "DTC",
    "customer retention",
    "open source",
  ],
  openGraph: {
    type: "website",
    siteName: "Threadline",
    title: "Threadline — the post-purchase text concierge",
    description:
      "One persistent SMS thread per customer, grounded in your live Shopify catalog — answering questions before checkout and following up after delivery. Open source.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Threadline — the post-purchase text concierge",
    description:
      "One persistent SMS thread per customer, grounded in your live Shopify catalog. Open source.",
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
      suppressHydrationWarning
      className={`${sans.variable} ${mono.variable} ${serif.variable}`}
    >
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
