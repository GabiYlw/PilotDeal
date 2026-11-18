// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { PRESET_QUESTIONS, presetAnswer } from "@/demo/ask";

// A stored answer like the one `npm --prefix api run demo:answers` writes.
vi.mock("@/demo/data/ask-answers.json", () => ({
  default: {
    questions: [
      {
        question: "Which deals are waiting on a contract?",
        answer: "Northwind's legal team is reviewing the contract [S1].",
        insufficientInformation: false,
        citedInteractionIds: ["warehouse-route-optimization-platform-note-4"],
        sources: [
          {
            label: "S1",
            interactionId: "warehouse-route-optimization-platform-note-4",
            excerpt: "Their legal team is reviewing the contract",
            similarity: 0.61,
          },
        ],
      },
    ],
  },
}));

const LOADED_AT = new Date("2026-11-18T12:00:00.000Z");

describe("presetAnswer", () => {
  it("lists the stored questions as the presets", () => {
    expect(PRESET_QUESTIONS).toEqual(["Which deals are waiting on a contract?"]);
  });

  it("returns the stored answer as an /ask response with the source's deal and date", () => {
    const response = presetAnswer("Which deals are waiting on a contract?", LOADED_AT);

    expect(response).toMatchObject({ answeredBy: "llm", answer: expect.stringContaining("[S1]") });
    expect(response?.sources).toEqual([
      {
        label: "S1",
        interactionId: "warehouse-route-optimization-platform-note-4",
        dealId: "warehouse-route-optimization-platform",
        dealTitle: "Warehouse route optimization platform",
        companyName: "Northwind Logistics",
        type: "EMAIL",
        occurredAt: "2026-11-16T12:00:00.000Z",
        excerpt: "Their legal team is reviewing the contract",
        similarity: 0.61,
      },
    ]);
  });

  it("answers nothing for a question that is not a preset", () => {
    expect(presetAnswer("Who is the CEO?", LOADED_AT)).toBeNull();
  });
});
