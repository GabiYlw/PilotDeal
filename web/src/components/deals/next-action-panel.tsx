import { notFound } from "next/navigation";
import { ApiUnavailable } from "@/components/api-unavailable";
import { ClosedDealNotice } from "@/components/deals/closed-deal-notice";
import { NextActionCard } from "@/components/deals/next-action-card";
import { ApiError, DEAL_CLOSED, getDealNextAction } from "@/lib/api";
import type { DealNextAction } from "@/lib/types";

type Outcome = DealNextAction | "closed" | "unreachable";

async function fetchNextAction(dealId: string): Promise<Outcome> {
  try {
    return await getDealNextAction(dealId);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.code === DEAL_CLOSED) return "closed";
      if (error.status === 0) return "unreachable";
      if (error.status === 404) notFound();
    }
    throw error;
  }
}

export async function NextActionPanel({ dealId }: { dealId: string }) {
  const result = await fetchNextAction(dealId);
  if (result === "closed") return <ClosedDealNotice />;
  if (result === "unreachable") return <ApiUnavailable />;
  return <NextActionCard result={result} />;
}
