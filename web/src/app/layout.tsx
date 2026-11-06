import { GeistSans } from "geist/font/sans";
import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "PilotDeal",
  description: "AI-assisted mini CRM with deal priority scoring and natural-language questions.",
};

// suppressHydrationWarning: THEME_SCRIPT may add data-theme to <html> before React hydrates.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${GeistSans.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans text-sm md:flex-row">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-10">{children}</main>
      </body>
    </html>
  );
}
