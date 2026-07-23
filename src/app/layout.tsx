import type { Metadata } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GlassPointer } from "@/components/ui/glass-pointer";
import { Toaster } from "@/components/ui/toast";
import { NightMode } from "@/components/ui/night-mode";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { safeJsonLd } from "@/lib/safe-json-ld";

const poppins = Poppins({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Simplicity: R1 — AI Chat Assistant, Made in India",
    template: "%s · Simplicity",
  },
  description:
    "Simplicity: R1 — frontier reasoning refined down to what actually matters. Focus mode, real deliverables, memory, and an agent swarm in one calm assistant. Made in India, made for India.",
  applicationName: "Simplicity",
  metadataBase: new URL("https://simplicity-india.com"),
  keywords: [
    "Simplicity AI",
    "AI assistant India",
    "AI chat app",
    "frontier reasoning AI",
    "agent swarm AI",
    "AI focus mode",
    "Made in India AI",
  ],
  authors: [{ name: "Simplicity" }],
  category: "technology",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "Simplicity: R1 — AI Chat Assistant, Made in India",
    description:
      "Fast, focused frontier reasoning. Made in India, made for India.",
    siteName: "Simplicity",
    type: "website",
    url: "https://simplicity-india.com",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "Simplicity: R1 — AI Chat Assistant, Made in India",
    description: "Fast, focused frontier reasoning. Made in India, made for India.",
  },
};

export const viewport = {
  themeColor: "#060607",
};

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Simplicity",
  applicationCategory: "AI Chat Assistant",
  operatingSystem: "Web",
  url: "https://simplicity-india.com",
  description:
    "Simplicity: R1 — frontier reasoning refined down to what actually matters. Focus mode, real deliverables, memory, and an agent swarm in one calm assistant.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  countryOfOrigin: {
    "@type": "Country",
    name: "India",
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
      className={`dark ${poppins.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: safeJsonLd(JSON_LD) }}
        />
        <GlassPointer />
        <SmoothScroll />
        {children}
        <Toaster />
        <NightMode />
        <CookieConsent />
      </body>
    </html>
  );
}
