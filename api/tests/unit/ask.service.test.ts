import { describe, expect, it, vi } from "vitest";
import type { AnswerDraft, AnswerGenerator } from "../../src/ai/answer-generator.js";
import type { EmbeddingProvider } from "../../src/ai/embedding-provider.js";
import type { InteractionSearchRow } from "../../src/modules/ask/ask.schemas.js";
import { AskService, EXCERPT_LENGTH, MIN_SIMILARITY } from "../../src/modules/ask/ask.service.js";
import type { DealRepository } from "../../src/modules/deals/deals.repository.js";
import { EmbeddingUnavailableError, NotFoundError } from "../../src/shared/errors.js";
import { FakeEmbeddingProvider, fakeEmbedding } from "../support/fake-embedding-provider.js";

const dealId = "44444444-4444-4444-8444-444444444444";

function row(overrides: Partial<InteractionSearchRow> = {}): InteractionSearchRow {
  return {
    interactionId: "55555555-5555-4555-8555-555555555555",
    dealId,
    dealTitle: "Renewal",
    companyName: "Acme",
    type: "CALL",
    notes: "price",
    occurredAt: new Date("2026-01-02T00:00:00Z"),
    similarity: 1,
    ...overrides,
  };
}

function setup(
  provider: EmbeddingProvider = new FakeEmbeddingProvider(),
  generate: AnswerGenerator["generate"] = vi.fn().mockResolvedValue(null),
) {
  const askRepository = { searchInteractions: vi.fn().mockResolvedValue([]) };
  const dealRepository = { findById: vi.fn().mockResolvedValue({ id: dealId }) };
  const logger = { warn: vi.fn() };
  const service = new AskService(
    askRepository,
    dealRepository as unknown as DealRepository,
    provider,
    { generate },
    logger,
  );
  return { askRepository, dealRepository, logger, service, generate: vi.mocked(generate) };
}

describe("AskService", () => {
  it("uses a minimum similarity of 0.25", () => {
    expect(MIN_SIMILARITY).toBe(0.25);
  });

  it("uses an excerpt length of 300", () => {
    expect(EXCERPT_LENGTH).toBe(300);
  });

  it("searches with the question embedding, no deal filter, a distance of 0.75 and the limit", async () => {
    const { askRepository, dealRepository, service } = setup();

    await service.ask({ question: "price budget", limit: 7 });

    expect(askRepository.searchInteractions).toHaveBeenCalledWith({
      embedding: fakeEmbedding("price budget"),
      dealId: null,
      maxDistance: 0.75,
      limit: 7,
    });
    expect(dealRepository.findById).not.toHaveBeenCalled();
  });

  it("passes the deal id to the search when the deal exists", async () => {
    const { askRepository, dealRepository, service } = setup();

    await service.ask({ question: "price", dealId, limit: 5 });

    expect(dealRepository.findById).toHaveBeenCalledWith(dealId);
    expect(askRepository.searchInteractions).toHaveBeenCalledWith(
      expect.objectContaining({ dealId }),
    );
  });

  it("rejects with NotFoundError before embedding or searching when the deal does not exist", async () => {
    const provider = new FakeEmbeddingProvider();
    const { askRepository, dealRepository, service } = setup(provider);
    dealRepository.findById.mockResolvedValue(null);

    await expect(service.ask({ question: "price", dealId, limit: 5 })).rejects.toThrow(
      new NotFoundError(`Deal ${dealId} not found`),
    );
    expect(provider.calls).toEqual([]);
    expect(askRepository.searchInteractions).not.toHaveBeenCalled();
  });

  it("returns answer null, answeredBy none, and the sources in repository order without notes", async () => {
    const { askRepository, service } = setup();
    const first = row({ interactionId: "a", notes: "first", similarity: 0.9 });
    const second = row({ interactionId: "b", notes: "second", similarity: 0.5 });
    askRepository.searchInteractions.mockResolvedValue([first, second]);

    const response = await service.ask({ question: "price", limit: 5 });

    expect(response.answer).toBeNull();
    expect(response.answeredBy).toBe("none");
    expect(response.sources).toEqual([
      {
        label: "S1",
        interactionId: "a",
        dealId,
        dealTitle: "Renewal",
        companyName: "Acme",
        type: "CALL",
        occurredAt: first.occurredAt,
        excerpt: "first",
        similarity: 0.9,
      },
      {
        label: "S2",
        interactionId: "b",
        dealId,
        dealTitle: "Renewal",
        companyName: "Acme",
        type: "CALL",
        occurredAt: second.occurredAt,
        excerpt: "second",
        similarity: 0.5,
      },
    ]);
    expect(response.sources.every((source) => !("notes" in source))).toBe(true);
  });

  it("returns an empty sources array when nothing matches", async () => {
    const { service } = setup();

    await expect(service.ask({ question: "price", limit: 5 })).resolves.toEqual({
      answer: null,
      answeredBy: "none",
      insufficientInformation: false,
      citedInteractionIds: [],
      sources: [],
    });
  });

  it("does not call the generator when no sources are found", async () => {
    const { generate, service } = setup();

    await service.ask({ question: "price", limit: 5 });

    expect(generate).not.toHaveBeenCalled();
  });

  describe("answer generation", () => {
    const first = row({ interactionId: "a", notes: "first", similarity: 0.9 });
    const second = row({ interactionId: "b", notes: "second", similarity: 0.5 });

    function setupWithDraft(draft: AnswerDraft | null) {
      const context = setup(undefined, vi.fn().mockResolvedValue(draft));
      context.askRepository.searchInteractions.mockResolvedValue([first, second]);
      return context;
    }

    function draftOf(overrides: Partial<AnswerDraft> = {}): AnswerDraft {
      return {
        answer: "It is [S1].",
        citedLabels: ["S1"],
        insufficientInformation: false,
        ...overrides,
      };
    }

    it("passes the question and the labelled sources with their full notes to the generator", async () => {
      const longNotes = "x".repeat(EXCERPT_LENGTH + 50);
      const { askRepository, generate, service } = setup();
      askRepository.searchInteractions.mockResolvedValue([
        { ...first, notes: longNotes },
        second,
      ]);

      await service.ask({ question: "what happened?", limit: 5 });

      expect(generate).toHaveBeenCalledTimes(1);
      expect(generate).toHaveBeenCalledWith("what happened?", [
        {
          label: "S1",
          dealTitle: "Renewal",
          companyName: "Acme",
          type: "CALL",
          occurredAt: first.occurredAt,
          notes: longNotes,
        },
        {
          label: "S2",
          dealTitle: "Renewal",
          companyName: "Acme",
          type: "CALL",
          occurredAt: second.occurredAt,
          notes: "second",
        },
      ]);
    });

    it("returns the llm answer with the cited interaction ids and labelled sources", async () => {
      const { service, logger } = setupWithDraft(draftOf());

      const response = await service.ask({ question: "price", limit: 5 });

      expect(response).toMatchObject({
        answer: "It is [S1].",
        answeredBy: "llm",
        insufficientInformation: false,
        citedInteractionIds: ["a"],
      });
      expect(response.sources.map((source) => source.label)).toEqual(["S1", "S2"]);
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it.each([
      ["a single label", ["S1"], ["a"]],
      ["labels in reverse order", ["S2", "S1"], ["a", "b"]],
      ["duplicate labels", ["S1", "S1"], ["a"]],
      [
        "unknown, padded, lowercase, bracketed and empty labels",
        ["S1", "S9", " S2 ", "s2", "[S1]", ""],
        ["a", "b"],
      ],
    ])("maps %s to interaction ids in source order", async (_name, citedLabels, expected) => {
      const { service } = setupWithDraft(draftOf({ citedLabels }));

      const response = await service.ask({ question: "price", limit: 5 });

      expect(response.citedInteractionIds).toEqual(expected);
    });

    it.each([
      ["no citations", []],
      ["only unknown citations", ["S9"]],
    ])("falls back with one warning when the answer has %s", async (_name, citedLabels) => {
      const { service, logger } = setupWithDraft(draftOf({ citedLabels }));

      const response = await service.ask({ question: "price", limit: 5 });

      expect(response).toMatchObject({
        answer: null,
        answeredBy: "none",
        insufficientInformation: false,
        citedInteractionIds: [],
      });
      expect(response.sources).toHaveLength(2);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        "LLM answer cited no retrieved source, returning sources only",
        { sourceCount: 2, citedLabelCount: citedLabels.length },
      );
    });

    it("returns the llm answer without ids or a warning when the information is insufficient", async () => {
      const { service, logger } = setupWithDraft(
        draftOf({ answer: "The notes do not say.", citedLabels: [], insufficientInformation: true }),
      );

      const response = await service.ask({ question: "price", limit: 5 });

      expect(response).toMatchObject({
        answer: "The notes do not say.",
        answeredBy: "llm",
        insufficientInformation: true,
        citedInteractionIds: [],
      });
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it("keeps valid citations when the information is insufficient", async () => {
      const { service } = setupWithDraft(
        draftOf({ citedLabels: ["S2", "S9"], insufficientInformation: true }),
      );

      const response = await service.ask({ question: "price", limit: 5 });

      expect(response.citedInteractionIds).toEqual(["b"]);
    });

    it("falls back with one warning and without the question when the generator rejects", async () => {
      const { askRepository, logger, service } = setup(
        undefined,
        vi.fn().mockRejectedValue(new Error("boom")),
      );
      askRepository.searchInteractions.mockResolvedValue([first]);

      const response = await service.ask({ question: "secret question", limit: 5 });

      expect(response).toMatchObject({ answer: null, answeredBy: "none", citedInteractionIds: [] });
      expect(response.sources).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith("Answer generation failed, returning sources only", {
        error: "Error: boom",
      });
      expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("secret question");
    });

    it("falls back without a warning when the generator returns null", async () => {
      const { service, logger } = setupWithDraft(null);

      const response = await service.ask({ question: "price", limit: 5 });

      expect(response).toMatchObject({
        answer: null,
        answeredBy: "none",
        insufficientInformation: false,
        citedInteractionIds: [],
      });
      expect(response.sources).toHaveLength(2);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe("excerpt", () => {
    const emoji = "\u{1F600}";

    it.each([
      ["a short note", "hello", "hello"],
      ["a 300-char note", "a".repeat(300), "a".repeat(300)],
      ["a 301-char note", "a".repeat(301), "a".repeat(300)],
      ["a 1000-char note", `${"a".repeat(300)}${"b".repeat(700)}`, "a".repeat(300)],
      ["an emoji straddling position 300", `${"a".repeat(299)}${emoji}tail`, `${"a".repeat(299)}${emoji}`],
      ["an emoji right after 300 chars", `${"a".repeat(300)}${emoji}`, "a".repeat(300)],
    ])("is the first 300 code points for %s", async (_name, notes, expected) => {
      const { askRepository, service } = setup();
      askRepository.searchInteractions.mockResolvedValue([row({ notes })]);

      const response = await service.ask({ question: "price", limit: 5 });

      expect(response.sources[0]?.excerpt).toBe(expected);
    });
  });

  it.each([
    [0.70710678, 0.707],
    [0.31622, 0.316],
    [0.2426, 0.243],
    [1.0000001, 1],
    [-0.0000001, 0],
  ])("rounds the similarity %f to %f", async (raw, expected) => {
    const { askRepository, service } = setup();
    askRepository.searchInteractions.mockResolvedValue([row({ similarity: raw })]);

    const response = await service.ask({ question: "price", limit: 5 });

    expect(response.sources[0]?.similarity).toBe(expected);
  });

  it.each([
    ["the provider rejects", () => Promise.reject(new Error("model down"))],
    ["the provider returns a malformed vector", () => Promise.resolve([[1, 2]])],
  ])("rejects with EmbeddingUnavailableError and warns without the question when %s", async (_name, embed) => {
    const provider: EmbeddingProvider = { dimensions: 384, embed };
    const { askRepository, logger, service } = setup(provider);

    const error: unknown = await service.ask({ question: "secret question", limit: 5 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(EmbeddingUnavailableError);
    expect(error).toMatchObject({
      statusCode: 503,
      code: "EMBEDDING_UNAVAILABLE",
      message: "Semantic search is unavailable: the question could not be embedded",
    });
    expect(askRepository.searchInteractions).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("secret question");
  });
});
