import { HomeStatsView } from "@/components/home-stats-view";
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

// Server Component: fetches on every request. Render it inside <Suspense>.
export async function HomeStats() {
  const totals = await loadTotals();
  if (totals === null) return null;
  return <HomeStatsView openDeals={totals.openDeals} companies={totals.companies} />;
}

export { HomeStatsSkeleton } from "@/components/home-stats-view";
