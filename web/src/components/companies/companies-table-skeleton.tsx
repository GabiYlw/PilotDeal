import { Skeleton } from "@/components/ui/skeleton";

const ROWS = ["a", "b", "c", "d", "e", "f"];

export function CompaniesTableSkeleton() {
  return (
    <div role="status" aria-label="Loading companies" className="flex flex-col gap-2">
      <Skeleton className="h-9 w-full" />
      {ROWS.map((row) => (
        <Skeleton key={row} className="h-10 w-full" />
      ))}
    </div>
  );
}
