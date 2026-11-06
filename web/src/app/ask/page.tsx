import type { Metadata } from "next";
import { Suspense } from "react";
import { AskView } from "@/components/ask/ask-view";
import { AskPageSkeleton } from "@/components/ask/ask-skeleton";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Ask your CRM", robots: { index: false } };

// The header is static; searchParams are only read inside Suspense, so the shell can prerender.
export default function AskPage(props: PageProps<"/ask">) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Ask your CRM"
        description="Answers come only from your interaction notes and cite their sources."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Ask" }]}
      />
      <Suspense fallback={<AskPageSkeleton />}>
        <AskView searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
