"use client";

import { HomeStatsSkeleton, HomeStatsView } from "@/components/home-stats-view";
import { listCompanies, prioritizedDeals } from "../queries";
import { useDemoState } from "../store";

const COUNT_ONLY = { page: 1, pageSize: 1 };

// The home page totals from the demo's data, in the same view as the real app's.
export function DemoHomeStats() {
  const state = useDemoState();
  if (state === null) return <HomeStatsSkeleton />;
  return (
    <HomeStatsView
      openDeals={prioritizedDeals(state, COUNT_ONLY, state.loadedAt).meta.total}
      companies={listCompanies(state, COUNT_ONLY).meta.total}
    />
  );
}
