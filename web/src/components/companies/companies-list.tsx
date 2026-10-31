import { ApiUnavailable } from "@/components/api-unavailable";
import { CompaniesTable } from "@/components/companies/companies-table";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { getCompanies } from "@/lib/api";
import { loadCollection } from "@/lib/load";
import { COMPANIES_PAGE_SIZE, parsePageParam } from "@/lib/pagination";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Reads searchParams, so it must be rendered inside <Suspense>.
export async function CompaniesList({ searchParams }: { searchParams: SearchParams }) {
  const page = parsePageParam((await searchParams).page);
  const result = await loadCollection(getCompanies({ page, pageSize: COMPANIES_PAGE_SIZE }));
  if (result.status === "unreachable") {
    return <ApiUnavailable />;
  }
  const { data, meta } = result.data;
  if (meta.total === 0) {
    return (
      <EmptyState
        title="No companies yet"
        action={<ButtonLink href="/companies/new">New company</ButtonLink>}
      />
    );
  }
  if (data.length === 0) {
    return (
      <EmptyState
        title="This page is empty"
        action={
          <ButtonLink href="/companies" variant="secondary">
            Back to the first page
          </ButtonLink>
        }
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <CompaniesTable companies={data} />
      <Pagination
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        basePath="/companies"
      />
    </div>
  );
}
