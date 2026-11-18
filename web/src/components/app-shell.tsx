import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";
import { Sidebar } from "@/components/sidebar";
import { THEME_SCRIPT } from "@/lib/theme";

// The document around every page: theme script, sidebar and main column. The root layout uses it,
// and so does the static demo's layout (app/layout.demo.tsx), which adds a label to the sidebar.
//
// break-words on <body>: a long word (a URL, a name without spaces) wraps instead of widening the
// page. Unlike overflow-wrap: anywhere it does not change min-content, so table columns keep their
// widths.
// suppressHydrationWarning on <html>: THEME_SCRIPT may add data-theme before React hydrates.
// On <body>: browser extensions (ColorZilla's cz-shortcut-listen, Grammarly, ...) add attributes
// before hydration. It only ignores attribute differences on that one element, not its children.
export function AppShell({
  sidebarLabel,
  children,
}: {
  sidebarLabel?: ReactNode;
  children: ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} h-full antialiased`} suppressHydrationWarning>
      {/* A plain <head> is right in the App Router; the rule only expects it in a layout file. */}
      {/* eslint-disable-next-line @next/next/no-head-element */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body
        className="flex min-h-full flex-col font-sans text-sm break-words md:flex-row"
        suppressHydrationWarning
      >
        <Sidebar label={sidebarLabel} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-10">{children}</main>
      </body>
    </html>
  );
}
