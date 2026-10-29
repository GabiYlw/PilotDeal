import { describe, expect, it, vi } from "vitest";
import type { EmbeddingProvider } from "../../src/ai/embedding-provider.js";
import { InteractionEmbeddingService } from "../../src/modules/interactions/interaction-embeddings.service.js";
import type { InteractionRepository } from "../../src/modules/interactions/interactions.repository.js";
import { FakeEmbeddingProvider, fakeEmbedding } from "../support/fake-embedding-provider.js";
import { formatBackfillResult } from "../../src/scripts/run-embedding-backfill.js";

const SECRET_NOTES = "Confidential price budget details";

function createRepository() {
  return {
    saveEmbedding: vi.fn().mockResolvedValue(true),
    clearEmbedding: vi.fn().mockResolvedValue(true),
    listMissingEmbeddings: vi.fn().mockResolvedValue([]),
  };
}

function setup(provider: EmbeddingProvider = new FakeEmbeddingProvider()) {
  const repository = createRepository();
  const logger = { warn: vi.fn() };
  const service = new InteractionEmbeddingService(
    repository as unknown as InteractionRepository,
    provider,
    logger,
  );
  return { repository, logger, service, provider };
}

function rows(count: number): { id: string; notes: string }[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `id${index + 1}`,
    notes: `note ${index + 1} price`,
  }));
}

// Serves the rows with keyset semantics: ids greater than afterId, at most limit.
function serve(repository: ReturnType<typeof createRepository>, all: { id: string; notes: string }[]) {
  repository.listMissingEmbeddings.mockImplementation((afterId: string | null, limit: number) =>
    Promise.resolve(all.filter((row) => afterId === null || row.id > afterId).slice(0, limit)),
  );
}

describe("InteractionEmbeddingService.refreshEmbedding", () => {
  it("saves the embedding of the notes and does not warn", async () => {
    const { repository, logger, service } = setup();

    await service.refreshEmbedding({ id: "i1", notes: SECRET_NOTES });

    expect(repository.saveEmbedding).toHaveBeenCalledWith("i1", SECRET_NOTES, fakeEmbedding(SECRET_NOTES));
    expect(repository.clearEmbedding).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("resolves, clears the embedding and warns without the notes when the provider rejects", async () => {
    const provider = new FakeEmbeddingProvider();
    provider.failWith(new Error("model exploded"));
    const { repository, logger, service } = setup(provider);

    await expect(service.refreshEmbedding({ id: "i1", notes: SECRET_NOTES })).resolves.toBeUndefined();

    expect(repository.saveEmbedding).not.toHaveBeenCalled();
    expect(repository.clearEmbedding).toHaveBeenCalledWith("i1", SECRET_NOTES);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0]?.[1]).toEqual({
      interactionId: "i1",
      error: expect.stringContaining("model exploded") as string,
    });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(SECRET_NOTES);
  });

  it.each([
    ["wrong vector length", [[1, 2, 3]]],
    ["a NaN element", [new Array<number>(384).fill(Number.NaN)]],
    ["the wrong vector count", []],
  ])("handles a malformed provider output (%s) like a provider failure", async (_name, vectors) => {
    const provider: EmbeddingProvider = { dimensions: 384, embed: () => Promise.resolve(vectors) };
    const { repository, logger, service } = setup(provider);

    await expect(service.refreshEmbedding({ id: "i1", notes: SECRET_NOTES })).resolves.toBeUndefined();

    expect(repository.saveEmbedding).not.toHaveBeenCalled();
    expect(repository.clearEmbedding).toHaveBeenCalledWith("i1", SECRET_NOTES);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it("still resolves and warns twice when the provider and the clear both fail", async () => {
    const provider = new FakeEmbeddingProvider();
    provider.failWith();
    const { repository, logger, service } = setup(provider);
    repository.clearEmbedding.mockRejectedValue(new Error("db down"));

    await expect(service.refreshEmbedding({ id: "i1", notes: SECRET_NOTES })).resolves.toBeUndefined();

    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn.mock.calls[1]?.[1]).toEqual({
      interactionId: "i1",
      error: expect.stringContaining("db down") as string,
    });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(SECRET_NOTES);
  });

  it("treats a failing save as an embedding failure and clears the row", async () => {
    const { repository, logger, service } = setup();
    repository.saveEmbedding.mockRejectedValue(new Error("write failed"));

    await expect(service.refreshEmbedding({ id: "i1", notes: "price" })).resolves.toBeUndefined();

    expect(repository.clearEmbedding).toHaveBeenCalledWith("i1", "price");
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});

describe("InteractionEmbeddingService.backfillMissing", () => {
  it("walks the keyset in batches and embeds each batch with one provider call", async () => {
    const provider = new FakeEmbeddingProvider();
    const { repository, service } = setup(provider);
    const all = rows(5);
    serve(repository, all);

    const result = await service.backfillMissing(2);

    expect(result).toEqual({ updated: 5, failed: 0 });
    expect(repository.listMissingEmbeddings.mock.calls).toEqual([
      [null, 2],
      ["id2", 2],
      ["id4", 2],
    ]);
    expect(provider.calls).toEqual([
      [all[0]?.notes, all[1]?.notes],
      [all[2]?.notes, all[3]?.notes],
      [all[4]?.notes],
    ]);
    expect(repository.saveEmbedding).toHaveBeenCalledTimes(5);
    expect(repository.saveEmbedding).toHaveBeenNthCalledWith(
      5,
      "id5",
      "note 5 price",
      fakeEmbedding("note 5 price"),
    );
  });

  it("stops after a short batch", async () => {
    const { repository, service } = setup();
    serve(repository, rows(3));

    await service.backfillMissing(2);

    expect(repository.listMissingEmbeddings).toHaveBeenCalledTimes(2);
  });

  it("asks for another batch after a full last batch and stops on the empty one", async () => {
    const { repository, service } = setup();
    serve(repository, rows(4));

    await service.backfillMissing(2);

    expect(repository.listMissingEmbeddings).toHaveBeenCalledTimes(3);
  });

  it("uses a default batch size of 32", async () => {
    const { repository, service } = setup();

    await service.backfillMissing();

    expect(repository.listMissingEmbeddings).toHaveBeenCalledWith(null, 32);
  });

  it("counts a failing batch as failed, warns with its ids and still saves the other batches", async () => {
    const all = rows(5);
    const failingNote = all[2]?.notes ?? "";
    const provider: EmbeddingProvider = {
      dimensions: 384,
      embed: (texts) =>
        texts.includes(failingNote)
          ? Promise.reject(new Error("batch failed"))
          : Promise.resolve(texts.map(fakeEmbedding)),
    };
    const { repository, logger, service } = setup(provider);
    serve(repository, all);

    const result = await service.backfillMissing(2);

    expect(result).toEqual({ updated: 3, failed: 2 });
    expect(repository.saveEmbedding.mock.calls.map((call: unknown[]) => call[0])).toEqual(["id1", "id2", "id5"]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0]?.[1]).toEqual({
      interactionIds: ["id3", "id4"],
      error: expect.stringContaining("batch failed") as string,
    });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("note 3");
  });

  it("counts a batch with malformed provider output as failed", async () => {
    const provider: EmbeddingProvider = { dimensions: 384, embed: () => Promise.resolve([[1]]) };
    const { repository, service } = setup(provider);
    serve(repository, rows(1));

    await expect(service.backfillMissing(2)).resolves.toEqual({ updated: 0, failed: 1 });
    expect(repository.saveEmbedding).not.toHaveBeenCalled();
  });

  it("terminates when every batch fails", async () => {
    const provider = new FakeEmbeddingProvider();
    provider.failWith();
    const { repository, service } = setup(provider);
    serve(repository, rows(5));

    await expect(service.backfillMissing(2)).resolves.toEqual({ updated: 0, failed: 5 });
    expect(repository.listMissingEmbeddings).toHaveBeenCalledTimes(3);
  });

  it("counts a save that matches no row as neither updated nor failed", async () => {
    const { repository, service } = setup();
    serve(repository, rows(2));
    repository.saveEmbedding.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    await expect(service.backfillMissing(5)).resolves.toEqual({ updated: 1, failed: 0 });
  });

  it("returns zeros and never calls the provider when nothing is missing", async () => {
    const provider = new FakeEmbeddingProvider();
    const { service } = setup(provider);

    await expect(service.backfillMissing()).resolves.toEqual({ updated: 0, failed: 0 });
    expect(provider.calls).toEqual([]);
  });

  it("rejects when the repository fails instead of swallowing database errors", async () => {
    const { repository, service } = setup();
    repository.listMissingEmbeddings.mockRejectedValue(new Error("db down"));

    await expect(service.backfillMissing()).rejects.toThrow("db down");
  });

  it("rejects when saving fails instead of swallowing database errors", async () => {
    const { repository, service } = setup();
    serve(repository, rows(1));
    repository.saveEmbedding.mockRejectedValue(new Error("write failed"));

    await expect(service.backfillMissing()).rejects.toThrow("write failed");
  });

  it.each([[0], [-1], [1.5], [Number.NaN]])("rejects a batch size of %s with RangeError", async (size) => {
    const { service } = setup();

    await expect(service.backfillMissing(size)).rejects.toBeInstanceOf(RangeError);
  });
});

describe("formatBackfillResult", () => {
  it("formats the one-line summary", () => {
    expect(formatBackfillResult({ updated: 3, failed: 1 })).toBe(
      "Embedding backfill: 3 updated, 1 failed.",
    );
  });
});
