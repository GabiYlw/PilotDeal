import { Suspense } from "react";
import { CompaniesList } from "@/components/companies/companies-list";
import { CompaniesTableSkeleton } from "@/components/companies/companies-table-skeleton";
import { CompanyDeletedNotice } from "@/components/companies/company-deleted-notice";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

// The header is static; searchParams are only read inside Suspense (the notice and the list), so
// the shell can prerender.
export default function CompaniesPage(props: PageProps<"/companies">) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Companies"
        description="All companies, newest first."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Companies" }]}
        actions={<ButtonLink href="/companies/new">New company</ButtonLink>}
      />
      <Suspense fallback={null}>
        <CompanyDeletedNotice searchParams={props.searchParams} />
      </Suspense>
      <Suspense fallback={<CompaniesTableSkeleton />}>
        <CompaniesList searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
