export type CompanyDeletedOutcome = "deleted" | "already";

const MESSAGES: Record<CompanyDeletedOutcome, string> = {
  deleted: "Company deleted.",
  already: "This company was already deleted.",
};

const QUERY_VALUES: Record<CompanyDeletedOutcome, string> = { deleted: "1", already: "already" };

export function companyDeletedUrl(outcome: CompanyDeletedOutcome): string {
  return `/companies?deleted=${QUERY_VALUES[outcome]}`;
}

// Reads the ?deleted= search param. Anything unknown (including repeated params) gives no message.
export function companyDeletedMessage(value: string | string[] | undefined): string | null {
  if (value === QUERY_VALUES.deleted) return MESSAGES.deleted;
  if (value === QUERY_VALUES.already) return MESSAGES.already;
  return null;
}
