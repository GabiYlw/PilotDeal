import { Building2, Handshake } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard, StatGrid } from "@/components/ui/stat-card";

// The home page's overview, without the fetching (home-stats.tsx does that), so the static demo's
// home page can show its own totals with it. No server-only import.

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

// The totals as the API returns them (meta.total). Also used by the static demo's home page.
export function HomeStatsView({ openDeals, companies }: { openDeals: number; companies: number }) {
  return (
    <Overview>
      <StatGrid>
        <StatCard icon={Handshake} tone="teal" label="Open deals" value={openDeals} />
        <StatCard icon={Building2} tone="navy" label="Clients" value={companies} />
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
