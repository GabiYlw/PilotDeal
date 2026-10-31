import { CompanyDealsTable } from "@/components/companies/company-deals-table";
import type { CreateDealAction } from "@/components/companies/deal-create-form";
import { NewDealPanel } from "@/components/companies/new-deal-panel";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Deal } from "@/lib/types";

export function CompanyDealsSection({
  deals,
  total,
  createAction,
}: {
  deals: Deal[];
  total: number;
  createAction: CreateDealAction;
}) {
  return (
    <Card className="flex flex-col gap-5">
      <NewDealPanel action={createAction} />
      {deals.length === 0 ? (
        <EmptyState title="No deals yet" />
      ) : (
        <CompanyDealsTable deals={deals} />
      )}
      {total > deals.length && (
        <p className="text-sm text-muted">
          Showing the {deals.length} most recent of {total} deals.
        </p>
      )}
    </Card>
  );
}
