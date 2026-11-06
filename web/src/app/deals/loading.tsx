import { DealsTableSkeleton } from "@/components/deals/deals-table-skeleton";
import { PageHeader } from "@/components/ui/page-header";

export default function DealsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Deals"
        description="Open deals, ranked by priority."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Deals" }]}
      />
      <DealsTableSkeleton />
    </div>
  );
}
