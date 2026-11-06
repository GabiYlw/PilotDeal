import { Coins, MessageSquareText, MessagesSquare } from "lucide-react";
import { Suspense } from "react";
import {
  addInteraction,
  editDeal,
  editInteraction,
  removeDeal,
  removeInteraction,
  updateDealStage,
} from "@/app/deals/[id]/actions";
import { ApiUnavailable } from "@/components/api-unavailable";
import { DealDetailsCard } from "@/components/deals/deal-details-card";
import { NextActionSkeleton } from "@/components/deals/deal-detail-skeleton";
import { DealEditForm } from "@/components/deals/deal-edit-form";
import { DeleteDealButton } from "@/components/deals/delete-deal-button";
import { InteractionForm } from "@/components/deals/interaction-form";
import { InteractionTimeline } from "@/components/deals/interaction-timeline";
import { NextActionPanel } from "@/components/deals/next-action-panel";
import { StageForm } from "@/components/deals/stage-form";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { TextLink } from "@/components/ui/text-link";
import { askHref } from "@/lib/ask-display";
import { formatValue } from "@/lib/format";
import { getCompany, getDeal, getDealInteractions } from "@/lib/api";
import { loadResource } from "@/lib/load";
import { pageVersion } from "@/lib/page-version";

const TIMELINE_PAGE = { page: 1, pageSize: 100 };

export async function DealView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dealResult = await loadResource(getDeal(id));
  if (dealResult.status === "unreachable") {
    return <ApiUnavailable />;
  }
  const deal = dealResult.data;
  const [companyResult, interactionsResult] = await Promise.all([
    loadResource(getCompany(deal.companyId)),
    loadResource(getDealInteractions(id, TIMELINE_PAGE)),
  ]);
  if (companyResult.status === "unreachable" || interactionsResult.status === "unreachable") {
    return <ApiUnavailable />;
  }
  const company = companyResult.data;
  const { data: interactions, meta } = interactionsResult.data;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={deal.title}
        description={
          <>
            Company: <TextLink href={`/companies/${company.id}`}>{company.name}</TextLink>
          </>
        }
        actions={
          <>
            <ButtonLink href={askHref({ dealId: id })} variant="secondary">
              <MessageSquareText aria-hidden="true" className="size-4" strokeWidth={1.75} />
              Ask about this deal
            </ButtonLink>
            <DeleteDealButton dealTitle={deal.title} action={removeDeal.bind(null, id)} />
          </>
        }
        breadcrumb={[
          { label: "Home", href: "/" },
          { label: "Deals", href: "/deals" },
          { label: deal.title },
        ]}
      />
      <StatGrid>
        <StatCard icon={Coins} tone="navy" label="Value" value={formatValue(deal.value)} />
        <StatCard icon={MessagesSquare} tone="slate" label="Interactions" value={meta.total} />
      </StatGrid>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <DealDetailsCard deal={deal} />
          <Card className="flex flex-col gap-5">
            <CardHeader title="Interactions" />
            <InteractionForm
              action={addInteraction.bind(null, id)}
              pageVersion={pageVersion(deal, interactions, meta.total)}
            />
            <InteractionTimeline
              interactions={interactions}
              total={meta.total}
              actionsFor={(interaction) => ({
                edit: editInteraction.bind(null, id, interaction.id, interaction.occurredAt),
                remove: removeInteraction.bind(null, id, interaction.id),
              })}
            />
          </Card>
        </div>
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4">
            <CardHeader title="Edit deal" />
            <DealEditForm deal={deal} action={editDeal.bind(null, id, deal.companyId)} />
          </Card>
          <Card>
            <StageForm
              key={deal.stage}
              stage={deal.stage}
              action={updateDealStage.bind(null, id)}
            />
          </Card>
          <Suspense fallback={<NextActionSkeleton />}>
            <NextActionPanel dealId={id} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
