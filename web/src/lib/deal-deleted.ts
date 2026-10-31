export type DealDeletedOutcome = "deleted" | "already";

const MESSAGES: Record<DealDeletedOutcome, string> = {
  deleted: "Deal deleted.",
  already: "This deal was already deleted.",
};

const QUERY_VALUES: Record<DealDeletedOutcome, string> = { deleted: "1", already: "already" };

export function dealDeletedUrl(outcome: DealDeletedOutcome): string {
  return `/deals?deleted=${QUERY_VALUES[outcome]}`;
}

// Reads the ?deleted= search param. Anything unknown (including repeated params) gives no message.
export function dealDeletedMessage(value: string | string[] | undefined): string | null {
  if (value === QUERY_VALUES.deleted) return MESSAGES.deleted;
  if (value === QUERY_VALUES.already) return MESSAGES.already;
  return null;
}
