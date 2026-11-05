import { ApiUnavailable } from "@/components/api-unavailable";
import { DealsTable } from "@/components/deals/deals-table";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { getPrioritizedDeals } from "@/lib/api";
import { loadCollection } from "@/lib/load";
import { DEALS_PAGE_SIZE, parsePageParam } from "@/lib/pagination";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function PrioritizedDeals({ searchParams }: { searchParams: SearchParams }) {
  const page = parsePageParam((await searchParams).page);
  const result = await loadCollection(getPrioritizedDeals({ page, pageSize: DEALS_PAGE_SIZE }));
  if (result.status === "unreachable") {
    return <ApiUnavailable />;
  }
  const { data, meta } = result.data;
  if (meta.total === 0) {
    return <EmptyState title="No open deals" />;
  }
  if (data.length === 0) {
    return (
      <EmptyState
        title="This page is empty"
        action={
          <ButtonLink href="/deals" variant="secondary">
            Back to the first page
          </ButtonLink>
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <DealsTable items={data} meta={meta} />
      <Pagination page={meta.page} pageSize={meta.pageSize} total={meta.total} basePath="/deals" />
    </div>
  );
}
