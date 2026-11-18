import type { Metadata } from "next";
import { Suspense } from "react";
import { AskPageSkeleton } from "@/components/ask/ask-skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { DemoAsk } from "@/demo/components/demo-ask";

export const metadata: Metadata = { title: "Ask the Pilot", robots: { index: false } };

export default function DemoAskPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Ask the Pilot"
        description="Answers come only from your interaction notes and cite their sources."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Ask" }]}
      />
      <Suspense fallback={<AskPageSkeleton />}>
        <DemoAsk />
      </Suspense>
    </div>
  );
}
