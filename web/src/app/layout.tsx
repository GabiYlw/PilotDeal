import type { Metadata } from "next";
import { Sidebar } from "@/components/sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "PilotDeal",
  description: "AI-assisted mini CRM with deal priority scoring and natural-language questions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-slate-50 text-slate-900 md:flex-row">
        <Sidebar />
        <main className="flex-1 px-6 py-8 md:px-10">{children}</main>
      </body>
    </html>
  );
}
