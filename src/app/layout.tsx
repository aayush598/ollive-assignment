import type { Metadata } from "next";
import { Geist, Geist_Mono, Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { PwaRegister } from "@/components/pwa-register";
import { WebVitals } from "@/lib/web-vitals";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono-alt",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: "AI Ops TaskFlow",
    template: "%s | AI Ops TaskFlow",
  },
  description:
    "The workflow platform AI ops teams love. Manage annotation tasks, review pipelines, evaluation workflows, and QA processes with built-in AI assistance.",
  keywords: [
    "AI ops",
    "workflow",
    "evaluation",
    "annotation",
    "LLM",
    "inference",
    "logging",
    "monitoring",
    "AI",
    "machine learning",
  ],
  authors: [{ name: "AI Ops TaskFlow" }],
  creator: "AI Ops TaskFlow",
  publisher: "AI Ops TaskFlow",
  metadataBase: new URL(baseUrl),
  openGraph: {
    title: "AI Ops TaskFlow",
    description: "The workflow platform AI ops teams love.",
    url: baseUrl,
    siteName: "AI Ops TaskFlow",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Ops TaskFlow",
    description: "The workflow platform AI ops teams love.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "AI Ops TaskFlow",
  },
  formatDetection: {
    telephone: false,
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
      className={`${geistSans.variable} ${geistMono.variable} ${bricolage.variable} ${ibmPlexMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="application-name" content="AI Ops TaskFlow" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="AI Ops TaskFlow" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className="min-h-full flex flex-col bg-white text-slate-900">
        <ClerkProvider>
          {children}
          <Suspense fallback={null}>
            <AnalyticsTracker />
          </Suspense>
          <WebVitals />
          <PwaRegister />
        </ClerkProvider>
      </body>
    </html>
  );
}
