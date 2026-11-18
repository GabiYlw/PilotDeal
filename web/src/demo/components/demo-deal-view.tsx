"use client";

import { Coins, MessageSquareText, MessagesSquare } from "lucide-react";
import { notFound } from "next/navigation";
import { ClosedDealNotice } from "@/components/deals/closed-deal-notice";
import { DealDetailSkeleton } from "@/components/deals/deal-detail-skeleton";
import { DealDetailsCard } from "@/components/deals/deal-details-card";
import { DealEditForm } from "@/components/deals/deal-edit-form";
import { DeleteDealButton } from "@/components/deals/delete-deal-button";
import { InteractionForm } from "@/components/deals/interaction-form";
import { InteractionTimeline } from "@/components/deals/interaction-timeline";
import { NextActionCard } from "@/components/deals/next-action-card";
import { StageForm } from "@/components/deals/stage-form";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { TextLink } from "@/components/ui/text-link";
import { askHref } from "@/lib/ask-display";
import { formatValue } from "@/lib/format";
import { pageVersion } from "@/lib/page-version";
import {
  addInteraction,
  editDeal,
  editInteraction,
  removeDeal,
  removeInteraction,
  updateDealStage,
} from "../actions";
import { dealInteractions, findCompany, findDeal, nextAction } from "../queries";
import { useDemoState } from "../store";
import { DeletedInDemo } from "./demo-states";

// The deal page from the demo's data, laid out like the real DealView. The next action is scored in
// the browser with the API's rules, so it changes as soon as the stage, value or dates change.
// "Ask about this deal" opens the demo's Ask page without a deal scope: the demo's preset answers
// cover all the sample notes, so a scope it cannot apply is not shown.
export function DemoDealView({ id }: { id: string }) {
  const state = useDemoState();
  if (state === null) return <DealDetailSkeleton />;
  const deal = findDeal(state, id);
  if (!deal) {
    if (state.deletedIds.has(id)) return <DeletedInDemo what="deal" listHref="/deals" />;
    notFound();
  }
  const company = findCompany(state, deal.companyId);
  const interactions = dealInteractions(state, id);
  const result = nextAction(state, deal, state.loadedAt);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={deal.title}
        description={
          company && (
            <>
              Client: <TextLink href={`/clients/${company.id}`}>{company.name}</TextLink>
            </>
          )
        }
        actions={
          <>
            <ButtonLink href={askHref({})} variant="secondary">
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
        <StatCard
          icon={MessagesSquare}
          tone="slate"
          label="Interactions"
          value={interactions.length}
        />
      </StatGrid>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <DealDetailsCard deal={deal} />
          <Card className="flex flex-col gap-5">
            <CardHeader title="Interactions" />
            <InteractionForm
              action={addInteraction.bind(null, id)}
              pageVersion={pageVersion(deal, interactions, interactions.length)}
            />
            <InteractionTimeline
              interactions={interactions}
              total={interactions.length}
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
          {result === null ? <ClosedDealNotice /> : <NextActionCard result={result} />}
        </div>
      </div>
    </div>
  );
}
