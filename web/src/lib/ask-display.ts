export interface AskParams {
  question: string | null;
  dealId: string | null;
}

type SearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// q is not trimmed: the API trims and validates it. An absent q means "no question yet", an
// empty one means "submitted empty" (the API explains why that is not allowed).
export function parseAskParams(params: SearchParams): AskParams {
  const dealId = firstValue(params.dealId);
  return {
    question: firstValue(params.q) ?? null,
    dealId: dealId === undefined || dealId === "" ? null : dealId,
  };
}

// URLSearchParams does the encoding, so &, #, ? and unicode in a question stay safe.
export function askHref({
  question,
  dealId,
}: {
  question?: string | null;
  dealId?: string | null;
}): string {
  const params = new URLSearchParams();
  if (question !== null && question !== undefined) params.set("q", question);
  if (dealId !== null && dealId !== undefined) params.set("dealId", dealId);
  const query = params.toString();
  return query === "" ? "/ask" : `/ask?${query}`;
}

export const EXAMPLE_QUESTIONS = [
  "Which customers are worried about price or budget?",
  "Is a competitor involved in any deal?",
  "Which deals are waiting on a contract?",
] as const;

export type RelevanceLevel = "high" | "medium" | "low";

// Display bands for cosine similarity; the API already drops anything below 0.25.
export const HIGH_RELEVANCE = 0.6;
export const MEDIUM_RELEVANCE = 0.4;

export function relevanceLevel(similarity: number): RelevanceLevel {
  if (similarity >= HIGH_RELEVANCE) return "high";
  if (similarity >= MEDIUM_RELEVANCE) return "medium";
  return "low";
}

export const RELEVANCE_LABELS: Record<RelevanceLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
