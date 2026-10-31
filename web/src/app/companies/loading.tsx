import { CompaniesTableSkeleton } from "@/components/companies/companies-table-skeleton";
import { PageHeader } from "@/components/ui/page-header";

export default function CompaniesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Companies" description="All companies, newest first." />
      <CompaniesTableSkeleton />
    </div>
  );
}
