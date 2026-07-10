import type { Metadata } from "next";
import { Poppins, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GlassPointer } from "@/components/ui/glass-pointer";
import { Toaster } from "@/components/ui/toast";
import { NightMode } from "@/components/ui/night-mode";

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
    default: "Simplicity R1",
    template: "%s · Simplicity",
  },
  description:
    "Simplicity R1 — frontier reasoning refined down to what actually matters. Focus mode, real deliverables, memory, and an agent swarm in one calm assistant.",
  applicationName: "Simplicity",
  openGraph: {
    title: "Simplicity R1",
    description:
      "Fast, focused frontier reasoning. Made in India, made for India.",
    siteName: "Simplicity",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Simplicity R1",
    description: "Fast, focused frontier reasoning. Made in India, made for India.",
  },
};

export const viewport = {
  themeColor: "#060607",
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
        <GlassPointer />
        {children}
        <Toaster />
        <NightMode />
      </body>
    </html>
  );
}
