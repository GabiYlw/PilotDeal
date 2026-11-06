import { Building2, Handshake } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { ApiError, getCompanies, getPrioritizedDeals } from "@/lib/api";

// Only meta.total is read, so one item per page is enough.
const COUNT_ONLY = { page: 1, pageSize: 1 };

async function loadTotals(): Promise<{ openDeals: number; companies: number } | null> {
  try {
    const [deals, companies] = await Promise.all([
      getPrioritizedDeals(COUNT_ONLY),
      getCompanies(COUNT_ONLY),
    ]);
    return { openDeals: deals.meta.total, companies: companies.meta.total };
  } catch (error) {
    // Any API failure hides the stats; the health badge above already explains it.
    if (error instanceof ApiError) return null;
    throw error;
  }
}

function Overview({ children }: { children: ReactNode }) {
  return (
    <section aria-labelledby="overview" className="flex flex-col gap-4">
      <h2 id="overview" className="text-xs font-medium tracking-wide text-muted uppercase">
        Overview
      </h2>
      {children}
    </section>
  );
}

// Server Component: fetches on every request. Render it inside <Suspense>.
export async function HomeStats() {
  const totals = await loadTotals();
  if (totals === null) return null;
  return (
    <Overview>
      <StatGrid>
        <StatCard icon={Handshake} tone="teal" label="Open deals" value={totals.openDeals} />
        <StatCard icon={Building2} tone="navy" label="Companies" value={totals.companies} />
      </StatGrid>
    </Overview>
  );
}

export function HomeStatsSkeleton() {
  return (
    <Overview>
      <div role="status" aria-label="Loading totals" className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </Overview>
  );
}
