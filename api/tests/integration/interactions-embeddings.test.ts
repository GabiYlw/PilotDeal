import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { FakeEmbeddingProvider, fakeEmbedding } from "../support/fake-embedding-provider.js";
import { createTestPrisma, readEmbedding, resetDatabase } from "./database.js";
import { bodyOf } from "./http.js";
import { loadTestConfig } from "./test-env.js";
import { createTestContainer } from "./test-container.js";

const config = loadTestConfig();
const fake = new FakeEmbeddingProvider();
const logger = { warn: vi.fn() };
const container = createTestContainer(config, { embeddingProvider: fake, logger });
const app = createApp(container.controllers);
const prisma = createTestPrisma(config.databaseUrl);

beforeEach(async () => {
  await resetDatabase(prisma);
  fake.reset();
  logger.warn.mockClear();
});

afterAll(async () => {
  await Promise.all([container.disconnect(), prisma.$disconnect()]);
});

async function createDeal(): Promise<string> {
  const company = await prisma.company.create({ data: { name: "Acme" } });
  return (await prisma.deal.create({ data: { companyId: company.id, title: "D", value: 1 } })).id;
}

async function postInteraction(dealId: string, notes: string) {
  return request(app).post(`/deals/${dealId}/interactions`).send({ type: "NOTE", notes });
}

function expectCloseTo(actual: number[] | null, expected: number[]): void {
  expect(actual).not.toBeNull();
  expect(actual).toHaveLength(expected.length);
  (actual ?? []).forEach((value, index) => {
    expect(value).toBeCloseTo(expected[index] ?? Number.NaN, 5);
  });
}

describe("embeddings on interactions", () => {
  it("stores the embedding of the notes when an interaction is created", async () => {
    const dealId = await createDeal();

    const response = await postInteraction(dealId, "Price question");

    expect(response.status).toBe(201);
    expect(response.body).not.toHaveProperty("embedding");
    expectCloseTo(
      await readEmbedding(prisma, bodyOf(response).id),
      fakeEmbedding("Price question"),
    );
  });

  it("recomputes the embedding when the notes change", async () => {
    const dealId = await createDeal();
    const id = bodyOf(await postInteraction(dealId, "Price question")).id;

    const response = await request(app)
      .patch(`/interactions/${id}`)
      .send({ notes: "Contract delay" });

    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("embedding");
    expectCloseTo(await readEmbedding(prisma, id), fakeEmbedding("Contract delay"));
  });

  it.each([
    ["type", { type: "CALL" }],
    ["occurredAt", { occurredAt: "2026-01-15T10:30:00Z" }],
  ])("keeps the embedding and calls no provider when only %s changes", async (_name, patch) => {
    const dealId = await createDeal();
    const id = bodyOf(await postInteraction(dealId, "Price question")).id;
    const before = await readEmbedding(prisma, id);
    expect(before).not.toBeNull();
    const callsBefore = fake.calls.length;

    const response = await request(app).patch(`/interactions/${id}`).send(patch);

    expect(response.status).toBe(200);
    expect(await readEmbedding(prisma, id)).toEqual(before);
    expect(fake.calls.length).toBe(callsBefore);
  });

  it("creates the interaction with a null embedding and logs a warning without the notes when the provider fails", async () => {
    const dealId = await createDeal();
    fake.failWith();

    const response = await postInteraction(dealId, "Secret price notes");

    expect(response.status).toBe(201);
    expect(bodyOf(response)).toMatchObject({ dealId, type: "NOTE", notes: "Secret price notes" });
    const id = bodyOf(response).id;
    expect(await readEmbedding(prisma, id)).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ interactionId: id }),
    );
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("Secret price notes");
  });

  it("clears the stale embedding and still updates the notes when the provider fails on PATCH", async () => {
    const dealId = await createDeal();
    const id = bodyOf(await postInteraction(dealId, "Price question")).id;
    expect(await readEmbedding(prisma, id)).not.toBeNull();
    fake.failWith();

    const response = await request(app)
      .patch(`/interactions/${id}`)
      .send({ notes: "Contract delay" });

    expect(response.status).toBe(200);
    expect(bodyOf(response).notes).toBe("Contract delay");
    expect(await readEmbedding(prisma, id)).toBeNull();
    expect(logger.warn).toHaveBeenCalled();
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain("Contract delay");
  });

  it("does not change updatedAt when the embedding is stored", async () => {
    const dealId = await createDeal();

    const created = await postInteraction(dealId, "Price question");
    const fetched = await request(app).get(`/interactions/${bodyOf(created).id}`);

    expect(bodyOf(fetched).updatedAt).toBe(bodyOf(created).updatedAt);
  });

  it("does not call the provider when the interaction to update does not exist", async () => {
    const response = await request(app)
      .patch("/interactions/11111111-1111-4111-8111-111111111111")
      .send({ notes: "x" });

    expect(response.status).toBe(404);
    expect(fake.calls).toEqual([]);
  });
});
