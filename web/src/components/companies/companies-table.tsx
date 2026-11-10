import { DataCard, DataField, DataList, ResponsiveList } from "@/components/ui/data-list";
import { MutedText } from "@/components/ui/muted-text";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TextLink } from "@/components/ui/text-link";
import type { Company } from "@/lib/types";

function Website({ company, standalone }: { company: Company; standalone?: boolean }) {
  if (!company.website) {
    return <MutedText />;
  }
  return (
    <TextLink
      standalone={standalone}
      href={company.website}
      target="_blank"
      rel="noopener noreferrer"
    >
      {company.website}
    </TextLink>
  );
}

function CompanyCard({ company }: { company: Company }) {
  return (
    <DataCard
      title={
        <TextLink standalone href={`/clients/${company.id}`}>
          {company.name}
        </TextLink>
      }
    >
      <DataField label="Industry" wide>
        {company.industry ?? <MutedText />}
      </DataField>
      <DataField label="Website" wide>
        <Website company={company} standalone />
      </DataField>
    </DataCard>
  );
}

// Cards below md, the table from md up (see ResponsiveList).
export function CompaniesTable({ companies }: { companies: Company[] }) {
  return (
    <ResponsiveList
      cards={
        <DataList label="Clients">
          {companies.map((company) => (
            <CompanyCard key={company.id} company={company} />
          ))}
        </DataList>
      }
      table={
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
                  <TextLink href={`/clients/${company.id}`}>{company.name}</TextLink>
                </TableCell>
                <TableCell>{company.industry ?? <MutedText />}</TableCell>
                <TableCell>
                  <Website company={company} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      }
    />
  );
}
