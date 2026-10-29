import { describe, expect, it, vi } from "vitest";
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

function setup(provider: EmbeddingProvider = new FakeEmbeddingProvider()) {
  const askRepository = { searchInteractions: vi.fn().mockResolvedValue([]) };
  const dealRepository = { findById: vi.fn().mockResolvedValue({ id: dealId }) };
  const logger = { warn: vi.fn() };
  const service = new AskService(
    askRepository,
    dealRepository as unknown as DealRepository,
    provider,
    logger,
  );
  return { askRepository, dealRepository, logger, service };
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
      sources: [],
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
