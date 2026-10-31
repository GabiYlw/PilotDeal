import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MutedText } from "@/components/ui/muted-text";
import { TextLink } from "@/components/ui/text-link";
import type { Company } from "@/lib/types";

export function CompaniesTable({ companies }: { companies: Company[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Industry</TableHead>
          <TableHead>Website</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {companies.map((company) => (
          <TableRow key={company.id}>
            <TableCell>
              <TextLink href={`/companies/${company.id}`}>{company.name}</TextLink>
            </TableCell>
            <TableCell>{company.industry ?? <MutedText />}</TableCell>
            <TableCell>
              {company.website ? (
                <TextLink href={company.website} target="_blank" rel="noopener noreferrer">
                  {company.website}
                </TextLink>
              ) : (
                <MutedText />
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
