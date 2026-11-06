import { StageBadge } from "@/components/deals/stage-badge";
import { Card, CardHeader } from "@/components/ui/card";
import { DescriptionItem, DescriptionList } from "@/components/ui/description-list";
import { formatDate } from "@/lib/format";
import type { Deal } from "@/lib/types";

export function DealDetailsCard({ deal }: { deal: Deal }) {
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title="Details" />
      <DescriptionList>
        <DescriptionItem term="Stage">
          <StageBadge stage={deal.stage} />
        </DescriptionItem>
        <DescriptionItem term="Expected close">
          {deal.expectedCloseDate ? (
            formatDate(deal.expectedCloseDate)
          ) : (
            <span className="text-muted">No date</span>
          )}
        </DescriptionItem>
        {deal.closedAt && (
          <DescriptionItem term="Closed on">{formatDate(deal.closedAt)}</DescriptionItem>
        )}
      </DescriptionList>
    </Card>
  );
}
