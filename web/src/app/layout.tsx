import type { Metadata } from "next";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: "PilotDeal",
  description: "AI-assisted mini CRM with deal priority scoring and natural-language questions.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
