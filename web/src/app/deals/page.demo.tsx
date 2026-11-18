import { Suspense } from "react";
import { DealsTableSkeleton } from "@/components/deals/deals-table-skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { DemoDealsList } from "@/demo/components/demo-lists";

export default function DemoDealsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Deals"
        description="Open deals, ranked by priority."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Deals" }]}
      />
      <Suspense fallback={<DealsTableSkeleton />}>
        <DemoDealsList />
      </Suspense>
    </div>
  );
}
