import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { DarkModeProvider } from "@/components/providers/DarkModeProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { ClientLayout } from "@/components/ClientLayout";

const inter = Inter({ subsets: ["latin"] });

const siteConfig = {
  name: "FinTrack",
  description:
    "Your intelligent financial management platform. Track expenses, analyze spending patterns, and make informed financial decisions with ease.",
  url: "https://fintrack-liart.vercel.app",
  ogImage: "https://fintrack-liart.vercel.app/og-image.png",
  keywords: [
    "finance management",
    "expense tracker",
    "budget planner",
    "financial analytics",
    "money management",
    "personal finance",
    "spending tracker",
    "financial dashboard",
    "CSV import",
    "transaction tracking",
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: "FinTrack - Smart Financial Management Platform",
    template: "%s | FinTrack",
  },
  description: siteConfig.description,
  keywords: siteConfig.keywords,
  authors: [
    {
      name: "FinTrack Team",
      url: siteConfig.url,
    },
  ],
  creator: "FinTrack",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: "FinTrack - Smart Financial Management Platform",
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: "FinTrack - Financial Management Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FinTrack - Smart Financial Management Platform",
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: "@fintrack",
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
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
      </head>

      <body className={inter.className}>
        <DarkModeProvider>
          <ToastProvider>
            <ClientLayout>{children}</ClientLayout>
          </ToastProvider>
        </DarkModeProvider>
      </body>
    </html>
  );
}