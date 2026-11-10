import { Skeleton } from "@/components/ui/skeleton";

export function CompanyDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading client" className="flex flex-col gap-6">
      <Skeleton className="h-12 w-72" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
