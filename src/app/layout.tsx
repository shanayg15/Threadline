import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

import { Providers } from "@/components/providers";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
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
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
