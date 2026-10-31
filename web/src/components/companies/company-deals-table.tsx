import { StageBadge } from "@/components/deals/stage-badge";
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
import type { Deal } from "@/lib/types";

export function CompanyDealsTable({ deals }: { deals: Deal[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Deal</TableHead>
          <TableHead>Stage</TableHead>
          <TableHead className="text-right">Value</TableHead>
          <TableHead>Expected close</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {deals.map((deal) => (
          <TableRow key={deal.id}>
            <TableCell>
              <TextLink href={`/deals/${deal.id}`}>{deal.title}</TextLink>
            </TableCell>
            <TableCell>
              <StageBadge stage={deal.stage} />
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatValue(deal.value)}</TableCell>
            <TableCell>
              {deal.expectedCloseDate ? (
                formatDate(deal.expectedCloseDate)
              ) : (
                <span className="text-muted">No date</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
