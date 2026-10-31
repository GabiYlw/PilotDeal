import type { AskResponse, AskSource } from "@/lib/types";

export function source(overrides: Partial<AskSource> = {}): AskSource {
  return {
    label: "S1",
    interactionId: "i1",
    dealId: "d1",
    dealTitle: "Big deal",
    companyName: "Acme Corp",
    type: "EMAIL",
    occurredAt: "2026-03-05T10:00:00.000Z",
    excerpt: "They think the price is too high.",
    similarity: 0.75,
    ...overrides,
  };
}

export function response(overrides: Partial<AskResponse> = {}): AskResponse {
  return {
    answer: "Acme worries about price [S1].",
    answeredBy: "llm",
    insufficientInformation: false,
    citedInteractionIds: ["i1"],
    sources: [source()],
    ...overrides,
  };
}
