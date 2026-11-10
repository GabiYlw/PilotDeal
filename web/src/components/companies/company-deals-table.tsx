import { StageBadge } from "@/components/deals/stage-badge";
import { DataCard, DataField, DataList, ResponsiveList } from "@/components/ui/data-list";
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

function CloseDate({ deal }: { deal: Deal }) {
  return deal.expectedCloseDate ? (
    formatDate(deal.expectedCloseDate)
  ) : (
    <span className="text-muted">No date</span>
  );
}

function DealCard({ deal }: { deal: Deal }) {
  return (
    <DataCard
      title={
        <TextLink standalone href={`/deals/${deal.id}`}>
          {deal.title}
        </TextLink>
      }
    >
      <DataField label="Stage">
        <StageBadge stage={deal.stage} />
      </DataField>
      <DataField label="Value">
        <span className="tabular-nums">{formatValue(deal.value)}</span>
      </DataField>
      <DataField label="Expected close" wide>
        <CloseDate deal={deal} />
      </DataField>
    </DataCard>
  );
}

// Cards below md, the table from md up (see ResponsiveList).
export function CompanyDealsTable({ deals }: { deals: Deal[] }) {
  return (
    <ResponsiveList
      cards={
        <DataList label="Deals">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </DataList>
      }
      table={
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
                  <CloseDate deal={deal} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}
