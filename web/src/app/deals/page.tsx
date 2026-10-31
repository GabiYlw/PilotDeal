import { Suspense } from "react";
import { DealDeletedNotice } from "@/components/deals/deal-deleted-notice";
import { DealsTableSkeleton } from "@/components/deals/deals-table-skeleton";
import { PrioritizedDeals } from "@/components/deals/prioritized-deals";
import { PageHeader } from "@/components/ui/page-header";

// The header is static; searchParams are only read inside Suspense (the notice and the list), so
// the shell can prerender.
export default function DealsPage(props: PageProps<"/deals">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Deals" description="Open deals, ranked by priority." />
      <Suspense fallback={null}>
        <DealDeletedNotice searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<DealsTableSkeleton />}>
        <PrioritizedDeals searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
