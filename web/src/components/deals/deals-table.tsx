import { OverdueBadge } from "@/components/deals/overdue-badge";
import { StageBadge } from "@/components/deals/stage-badge";
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

function DealRow({ item, rank }: { item: PrioritizedDeal; rank: number }) {
  const { deal, priority } = item;
  return (
    <TableRow>
      <TableCell className="text-muted tabular-nums">{rank}</TableCell>
      <TableCell>
        <TextLink href={`/deals/${deal.id}`}>{deal.title}</TextLink>
      </TableCell>
      <TableCell>{deal.companyName}</TableCell>
      <TableCell>
        <StageBadge stage={deal.stage} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{formatValue(deal.value)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          {deal.expectedCloseDate ? (
            <span>{formatDate(deal.expectedCloseDate)}</span>
          ) : (
            <span className="text-muted">No date</span>
          )}
          <OverdueBadge factors={priority.factors} />
        </div>
      </TableCell>
      <TableCell className="min-w-32">
        <ScoreBar score={priority.score} label={`Priority score for ${deal.title}`} />
      </TableCell>
      <TableCell className="max-w-sm text-muted">{priority.reason}</TableCell>
    </TableRow>
  );
}

export function DealsTable({ items, meta }: { items: PrioritizedDeal[]; meta: PaginationMeta }) {
  const firstRank = (meta.page - 1) * meta.pageSize + 1;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rank</TableHead>
          <TableHead>Deal</TableHead>
          <TableHead>Company</TableHead>
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
  );
}
