import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { runEmbeddingBackfill } from "../../src/scripts/run-embedding-backfill.js";
import { FakeEmbeddingProvider, fakeEmbedding } from "../support/fake-embedding-provider.js";
import { createTestPrisma, readEmbedding, resetDatabase, writeEmbedding } from "./database.js";
import { loadTestConfig } from "./test-env.js";
import { createTestContainer } from "./test-container.js";

const config = loadTestConfig();
const fake = new FakeEmbeddingProvider();
const logger = { warn: vi.fn() };
const container = createTestContainer(config, { embeddingProvider: fake, logger });
const prisma = createTestPrisma(config.databaseUrl);

beforeEach(async () => {
  await resetDatabase(prisma);
  fake.reset();
  logger.warn.mockClear();
});

afterAll(async () => {
  await Promise.all([container.disconnect(), prisma.$disconnect()]);
});

async function createInteractions(notes: string[]): Promise<string[]> {
  const company = await prisma.company.create({ data: { name: "Acme" } });
  const deal = await prisma.deal.create({ data: { companyId: company.id, title: "D", value: 1 } });
  const ids: string[] = [];
  for (const text of notes) {
    const row = await prisma.interaction.create({
      data: { dealId: deal.id, type: "NOTE", notes: text, occurredAt: new Date() },
    });
    ids.push(row.id);
  }
  return ids;
}

function expectCloseTo(actual: number[] | null, expected: number[]): void {
  expect(actual).not.toBeNull();
  (actual ?? []).forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index] ?? Number.NaN, 5);
  });
}

describe("InteractionEmbeddingService.backfillMissing (database)", () => {
  it("fills only the missing embeddings and reports the count", async () => {
    const [a, b, c, existing] = await createInteractions([
      "price",
      "budget timeline",
      "hello world",
      "price",
    ]);
    await writeEmbedding(prisma, existing ?? "", fakeEmbedding("contract"));

    const result = await container.interactionEmbeddings.backfillMissing();

    expect(result).toEqual({ updated: 3, failed: 0 });
    expectCloseTo(await readEmbedding(prisma, a ?? ""), fakeEmbedding("price"));
    expectCloseTo(await readEmbedding(prisma, b ?? ""), fakeEmbedding("budget timeline"));
    expectCloseTo(await readEmbedding(prisma, c ?? ""), fakeEmbedding("hello world"));
    expectCloseTo(await readEmbedding(prisma, existing ?? ""), fakeEmbedding("contract"));
    expect(fake.calls.flat().sort()).toEqual(["budget timeline", "hello world", "price"]);
  });

  it("finds nothing to do on a second run", async () => {
    await createInteractions(["price", "budget"]);
    await container.interactionEmbeddings.backfillMissing();
    fake.reset();

    await expect(container.interactionEmbeddings.backfillMissing()).resolves.toEqual({
      updated: 0,
      failed: 0,
    });
    expect(fake.calls).toEqual([]);
  });

  it("fills 5 missing rows in 3 provider calls with a batch size of 2", async () => {
    const ids = await createInteractions(["price", "budget", "timeline", "delay", "contract"]);

    const result = await container.interactionEmbeddings.backfillMissing(2);

    expect(result).toEqual({ updated: 5, failed: 0 });
    expect(fake.calls).toHaveLength(3);
    for (const id of ids) {
      expect(await readEmbedding(prisma, id)).not.toBeNull();
    }
  });

  it("reports failures, leaves the rows empty and terminates when the provider fails", async () => {
    const ids = await createInteractions(["price", "budget", "timeline"]);
    fake.failWith();

    const result = await container.interactionEmbeddings.backfillMissing(2);

    expect(result).toEqual({ updated: 0, failed: 3 });
    for (const id of ids) {
      expect(await readEmbedding(prisma, id)).toBeNull();
    }
  });
});

describe("runEmbeddingBackfill", () => {
  it("prints the one-line summary and returns the result", async () => {
    await createInteractions(["price", "budget"]);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    try {
      const result = await runEmbeddingBackfill(config, { embeddingProvider: fake, logger });

      expect(result).toEqual({ updated: 2, failed: 0 });
      expect(log).toHaveBeenCalledWith("Embedding backfill: 2 updated, 0 failed.");
    } finally {
      log.mockRestore();
    }
  });
});
