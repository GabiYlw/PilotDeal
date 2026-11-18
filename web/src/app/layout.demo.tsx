import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { DemoLabel } from "@/demo/components/demo-states";
import { DemoRouterBridge } from "@/demo/navigation";
import "./globals.css";

// The static demo's routes are the *.demo.tsx files: the demo build (npm run build:demo) only
// looks for that extension, and the normal build ignores it. See next.config.ts.

export const metadata: Metadata = {
  title: "PilotDeal demo",
  description:
    "A static demo of PilotDeal on sample data: deal priority scoring and Ask the Pilot, in the browser.",
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <AppShell sidebarLabel={<DemoLabel />}>
      <DemoRouterBridge />
      {children}
    </AppShell>
  );
}
