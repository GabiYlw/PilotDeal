import { OverdueBadge } from "@/components/deals/overdue-badge";
import { StageBadge } from "@/components/deals/stage-badge";
import { DataCard, DataField, DataList, ResponsiveList } from "@/components/ui/data-list";
import { ScoreBar } from "@/components/ui/score-bar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import { formatDate, formatValue } from "@/lib/format";
import type { PaginationMeta, PrioritizedDeal } from "@/lib/types";

function CloseDate({ item }: { item: PrioritizedDeal }) {
  const { deal, priority } = item;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {deal.expectedCloseDate ? (
        <span className="whitespace-nowrap">{formatDate(deal.expectedCloseDate)}</span>
      ) : (
        <span className="text-muted">No date</span>
      )}
      <OverdueBadge factors={priority.factors} />
    </div>
  );
}

function DealCard({ item, rank }: { item: PrioritizedDeal; rank: number }) {
  const { deal, priority } = item;
  return (
    <DataCard
      eyebrow={`#${rank}`}
      title={
        <TextLink standalone href={`/deals/${deal.id}`}>
          {deal.title}
        </TextLink>
      }
    >
      <DataField label="Client" wide>
        {deal.companyName}
      </DataField>
      <DataField label="Stage">
        <StageBadge stage={deal.stage} />
      </DataField>
      <DataField label="Value">
        <span className="tabular-nums">{formatValue(deal.value)}</span>
      </DataField>
      <DataField label="Expected close" wide>
        <CloseDate item={item} />
      </DataField>
      <DataField label="Score" wide>
        <ScoreBar score={priority.score} label={`Priority score for ${deal.title}`} />
      </DataField>
      <DataField label="Reason" wide>
        <span className="text-muted">{priority.reason}</span>
      </DataField>
    </DataCard>
  );
}

function DealRow({ item, rank }: { item: PrioritizedDeal; rank: number }) {
  const { deal, priority } = item;
  return (
    <TableRow>
      <TableCell className="text-muted tabular-nums">{rank}</TableCell>
      <TableCell className="min-w-40">
        <TextLink href={`/deals/${deal.id}`}>{deal.title}</TextLink>
      </TableCell>
      <TableCell>{deal.companyName}</TableCell>
      <TableCell>
        <StageBadge stage={deal.stage} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatValue(deal.value)}</TableCell>
      <TableCell className="whitespace-nowrap">
        <div className="flex items-center gap-2">
          {deal.expectedCloseDate ? (
            <span>{formatDate(deal.expectedCloseDate)}</span>
          ) : (
            <span className="text-muted">No date</span>
          )}
          <OverdueBadge factors={priority.factors} />
        </div>
      </TableCell>
      <TableCell className="w-40 min-w-36">
        <ScoreBar score={priority.score} label={`Priority score for ${deal.title}`} />
      </TableCell>
      <TableCell className="max-w-sm min-w-60 text-muted">{priority.reason}</TableCell>
    </TableRow>
  );
}

// Cards below md, the table from md up (see ResponsiveList).
export function DealsTable({ items, meta }: { items: PrioritizedDeal[]; meta: PaginationMeta }) {
  const firstRank = (meta.page - 1) * meta.pageSize + 1;
  return (
    <ResponsiveList
      cards={
        <DataList label="Deals">
          {items.map((item, index) => (
            <DealCard key={item.deal.id} item={item} rank={firstRank + index} />
          ))}
        </DataList>
      }
      table={
        <Table className="min-w-240">
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Deal</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Expected close</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => (
              <DealRow key={item.deal.id} item={item} rank={firstRank + index} />
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}
