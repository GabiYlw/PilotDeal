import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RevealObserver } from "@/components/reveal-observer";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { site } from "@/content";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.title,
  description: site.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: site.name,
    title: site.title,
    description: site.description,
    images: [
      {
        url: site.ogImage.path,
        width: site.ogImage.width,
        height: site.ogImage.height,
        alt: site.ogImage.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: site.title,
    description: site.description,
    images: [site.ogImage.path],
  },
};

// Sets the "js" class that enables the scroll fade-in (globals.css), so without JavaScript every
// section stays visible. The theme script runs first, before first paint.
const HEAD_SCRIPT = `${THEME_SCRIPT};document.documentElement.classList.add("js")`;

// suppressHydrationWarning on <html>: HEAD_SCRIPT changes its attributes before React hydrates.
// On <body>: browser extensions (ColorZilla's cz-shortcut-listen, Grammarly, ...) add attributes
// before hydration. It only ignores attribute differences on that one element, not its children.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col font-sans text-sm" suppressHydrationWarning>
        <a
          href="#main"
          className="sr-only rounded-full bg-accent px-4 py-2 font-semibold text-accent-foreground focus:not-sr-only focus:fixed focus:inline-flex focus:min-h-11 focus:items-center focus:top-3 focus:left-3 focus:z-50"
        >
          {site.skipLink}
        </a>
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
        <RevealObserver />
      </body>
    </html>
  );
}
