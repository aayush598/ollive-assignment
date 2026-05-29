import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: "LLM Inference Logger",
    template: "%s | LLM Inference Logger",
  },
  description:
    "Lightweight inference logging and ingestion system for LLM applications. Track, monitor, and analyze your LLM API calls.",
  keywords: [
    "LLM",
    "inference",
    "logging",
    "monitoring",
    "AI",
    "machine learning",
    "observability",
  ],
  authors: [{ name: "LLM Inference Logger" }],
  creator: "LLM Inference Logger",
  publisher: "LLM Inference Logger",
  metadataBase: new URL(baseUrl),
  openGraph: {
    title: "LLM Inference Logger",
    description: "Lightweight inference logging and ingestion system for LLM applications.",
    url: baseUrl,
    siteName: "LLM Inference Logger",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LLM Inference Logger",
    description: "Lightweight inference logging and ingestion system for LLM applications.",
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
    title: "LLM Logger",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <meta name="application-name" content="LLM Logger" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="LLM Logger" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
      </head>
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
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
