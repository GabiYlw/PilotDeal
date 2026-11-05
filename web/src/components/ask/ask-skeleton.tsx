import { AskForm } from "@/components/ask/ask-form";
import { Skeleton } from "@/components/ui/skeleton";

export function AskResultsSkeleton() {
  return (
    <div role="status" aria-label="Searching the notes" className="flex flex-col gap-3">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

// Fallback while the answer is generated: the submitted question stays visible, disabled.
export function AskPending({ question, dealId }: { question: string; dealId: string | null }) {
  return (
    <div className="flex flex-col gap-6">
      <AskForm question={question} dealId={dealId} pending />
      <AskResultsSkeleton />
    </div>
  );
}

export function AskPageSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-6">
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  );
}
