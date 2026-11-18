import { Suspense } from "react";
import { CompaniesTableSkeleton } from "@/components/companies/companies-table-skeleton";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DemoCompaniesList } from "@/demo/components/demo-lists";

export default function DemoCompaniesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        description="All clients, newest first."
        breadcrumb={[{ label: "Home", href: "/" }, { label: "Clients" }]}
        actions={<ButtonLink href="/clients/new">New client</ButtonLink>}
      />
      <Suspense fallback={<CompaniesTableSkeleton />}>
        <DemoCompaniesList />
      </Suspense>
    </div>
  );
}
