import { Suspense } from "react";
import { DealDetailSkeleton } from "@/components/deals/deal-detail-skeleton";
import { DealView } from "@/components/deals/deal-view";

// params are only read inside Suspense so the shell can prerender with Cache Components.
export default function DealPage(props: PageProps<"/deals/[id]">) {
  return (
    <Suspense fallback={<DealDetailSkeleton />}>
      <DealView params={props.params} />
    </Suspense>
  );
}
