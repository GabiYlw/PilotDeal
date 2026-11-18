"use client";

import { useSearchParams } from "next/navigation";
import { CompaniesTable } from "@/components/companies/companies-table";
import { CompaniesTableSkeleton } from "@/components/companies/companies-table-skeleton";
import { DealsTable } from "@/components/deals/deals-table";
import { DealsTableSkeleton } from "@/components/deals/deals-table-skeleton";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { companyDeletedMessage } from "@/lib/company-deleted";
import { dealDeletedMessage } from "@/lib/deal-deleted";
import { COMPANIES_PAGE_SIZE, DEALS_PAGE_SIZE, parsePageParam } from "@/lib/pagination";
import { listCompanies, prioritizedDeals } from "../queries";
import { useDemoState } from "../store";
import { DeletedNotice } from "./demo-states";

// The Deals and Clients lists from the demo's data: the same states and components as the real
// PrioritizedDeals and CompaniesList. useSearchParams needs a <Suspense> around these components
// in a static export.

function param(params: URLSearchParams, name: string): string | undefined {
  return params.get(name) ?? undefined;
}

function EmptyPage({ href }: { href: string }) {
  return (
    <EmptyState
      title="This page is empty"
      action={
        <ButtonLink href={href} variant="secondary">
          Back to the first page
        </ButtonLink>
      }
    />
  );
}

export function DemoDealsList() {
  const params = useSearchParams();
  const state = useDemoState();
  const message = dealDeletedMessage(param(params, "deleted"));
  if (state === null) return <DealsTableSkeleton />;
  const page = parsePageParam(param(params, "page"));
  const { data, meta } = prioritizedDeals(
    state,
    { page, pageSize: DEALS_PAGE_SIZE },
    state.loadedAt,
  );
  return (
    <>
      {message && <DeletedNotice message={message} dismissHref="/deals" />}
      {meta.total === 0 ? (
        <EmptyState title="No open deals" />
      ) : data.length === 0 ? (
        <EmptyPage href="/deals" />
      ) : (
        <div className="flex flex-col gap-4">
          <DealsTable items={data} meta={meta} />
          <Pagination
            page={meta.page}
            pageSize={meta.pageSize}
            total={meta.total}
            basePath="/deals"
          />
        </div>
      )}
    </>
  );
}

export function DemoCompaniesList() {
  const params = useSearchParams();
  const state = useDemoState();
  const message = companyDeletedMessage(param(params, "deleted"));
  if (state === null) return <CompaniesTableSkeleton />;
  const page = parsePageParam(param(params, "page"));
  const { data, meta } = listCompanies(state, { page, pageSize: COMPANIES_PAGE_SIZE });
  return (
    <>
      {message && <DeletedNotice message={message} dismissHref="/clients" />}
      {meta.total === 0 ? (
        <EmptyState
          title="No clients yet"
          action={<ButtonLink href="/clients/new">New client</ButtonLink>}
        />
      ) : data.length === 0 ? (
        <EmptyPage href="/clients" />
      ) : (
        <div className="flex flex-col gap-4">
          <CompaniesTable companies={data} />
          <Pagination
            page={meta.page}
            pageSize={meta.pageSize}
            total={meta.total}
            basePath="/clients"
          />
        </div>
      )}
    </>
  );
}
