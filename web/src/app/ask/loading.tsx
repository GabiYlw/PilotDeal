import { AskPageSkeleton } from "@/components/ask/ask-skeleton";
import { PageHeader } from "@/components/ui/page-header";

export default function AskLoading() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <PageHeader
        title="Ask the Pilot"
        description="Answers come only from your interaction notes and cite their sources."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Ask" }]}
      />
      <AskPageSkeleton />
    </div>
  );
}
