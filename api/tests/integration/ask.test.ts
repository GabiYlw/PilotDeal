import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { PrismaAskRepository } from "../../src/modules/ask/ask.repository.js";
import { FakeEmbeddingProvider, fakeEmbedding } from "../support/fake-embedding-provider.js";
import { createTestPrisma, resetDatabase } from "./database.js";
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

async function createDeal(companyName = "Acme", title = "Renewal"): Promise<string> {
  const company = await prisma.company.create({ data: { name: companyName } });
  return (await prisma.deal.create({ data: { companyId: company.id, title, value: 1 } })).id;
}

// Inserts with Prisma (embedding NULL), then embeds everything missing with the fake provider.
async function addNotes(dealId: string, notes: string[], embed = true): Promise<string[]> {
  const ids: string[] = [];
  for (const text of notes) {
    const row = await prisma.interaction.create({
      data: { dealId, type: "EMAIL", notes: text, occurredAt: new Date("2026-02-03T04:05:06Z") },
    });
    ids.push(row.id);
  }
  if (embed) {
    await container.interactionEmbeddings.backfillMissing();
  }
  fake.reset();
  return ids;
}

function ask(body: unknown) {
  return request(app)
    .post("/ask")
    .send(body as object);
}

function notesOf(response: { body: unknown }): string[] {
  return bodyOf(response as never).sources.map((source) => source.excerpt);
}

describe("POST /ask", () => {
  it("returns 200 with answer null, answeredBy none and sources with the documented keys", async () => {
    const dealId = await createDeal("Acme", "Renewal");
    const [id] = await addNotes(dealId, ["price"]);

    const response = await ask({ question: "price" });

    expect(response.status).toBe(200);
    expect(bodyOf(response).answer).toBeNull();
    expect(bodyOf(response).answeredBy).toBe("none");
    expect(bodyOf(response).insufficientInformation).toBe(false);
    expect(bodyOf(response).citedInteractionIds).toEqual([]);
    expect(bodyOf(response).sources).toHaveLength(1);
    const source = bodyOf(response).sources[0];
    expect(Object.keys(source ?? {}).sort()).toEqual(
      [
        "companyName",
        "dealId",
        "dealTitle",
        "excerpt",
        "interactionId",
        "label",
        "occurredAt",
        "similarity",
        "type",
      ].sort(),
    );
    expect(source).toEqual({
      label: "S1",
      interactionId: id,
      dealId,
      dealTitle: "Renewal",
      companyName: "Acme",
      type: "EMAIL",
      occurredAt: "2026-02-03T04:05:06.000Z",
      excerpt: "price",
      similarity: 1,
    });
  });

  it("orders the sources by similarity descending with similarities rounded to 3 decimals", async () => {
    const dealId = await createDeal();
    await addNotes(dealId, ["price budget timeline", "price", "price budget"]);

    const response = await ask({ question: "price?" });

    expect(notesOf(response)).toEqual(["price", "price budget", "price budget timeline"]);
    expect(bodyOf(response).sources.map((source) => source.similarity)).toEqual([1, 0.707, 0.577]);
    expect(bodyOf(response).sources.map((source) => source.label)).toEqual(["S1", "S2", "S3"]);
  });

  it("returns similarity 0.316 and excludes 0.243 and 0 with the 0.25 threshold", async () => {
    const dealId = await createDeal();
    await addNotes(dealId, [
      "price budget budget budget",
      "price budget budget budget budget",
      "budget",
    ]);

    const response = await ask({ question: "price" });

    expect(response.status).toBe(200);
    expect(notesOf(response)).toEqual(["price budget budget budget"]);
    expect(bodyOf(response).sources[0]?.similarity).toBe(0.316);
  });

  it.each([
    ["no limit (default 5)", undefined, 5],
    ["limit 2", 2, 2],
    ["limit 10", 10, 6],
  ])("returns the right number of sources for %s", async (_name, limit, expected) => {
    const dealId = await createDeal();
    await addNotes(
      dealId,
      Array.from({ length: 6 }, () => "price"),
    );

    const response = await ask(
      limit === undefined ? { question: "price" } : { question: "price", limit },
    );

    expect(response.status).toBe(200);
    expect(bodyOf(response).sources).toHaveLength(expected);
  });

  it("returns the top interactions when the limit cuts the list", async () => {
    const dealId = await createDeal();
    await addNotes(dealId, ["price budget timeline", "price", "price budget"]);

    const response = await ask({ question: "price", limit: 2 });

    expect(notesOf(response)).toEqual(["price", "price budget"]);
  });

  it("only returns interactions of the given deal, with that deal's title and company", async () => {
    const dealA = await createDeal("Company A", "Deal A");
    const dealB = await createDeal("Company B", "Deal B");
    await addNotes(dealA, ["price", "price budget"]);
    await addNotes(dealB, ["price", "price timeline"]);

    const scoped = await ask({ question: "price", dealId: dealA });
    const unscoped = await ask({ question: "price" });

    expect(scoped.status).toBe(200);
    expect(bodyOf(scoped).sources).toHaveLength(2);
    expect(
      bodyOf(scoped).sources.every(
        (source) =>
          source.dealId === dealA &&
          source.dealTitle === "Deal A" &&
          source.companyName === "Company A",
      ),
    ).toBe(true);
    expect(bodyOf(unscoped).sources).toHaveLength(4);
  });

  it("returns 200 with no sources for a deal without interactions", async () => {
    const dealId = await createDeal();

    const response = await ask({ question: "price", dealId });

    expect(response.status).toBe(200);
    expect(bodyOf(response).sources).toEqual([]);
  });

  it("returns 404 without embedding when the deal does not exist", async () => {
    const dealId = randomUUID();

    const response = await ask({ question: "price", dealId });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: "NOT_FOUND", message: `Deal ${dealId} not found` },
    });
    expect(fake.calls).toEqual([]);
  });

  it("skips interactions without an embedding", async () => {
    const dealId = await createDeal();
    await addNotes(dealId, ["price budget"]);
    await addNotes(dealId, ["price"], false);

    const response = await ask({ question: "price" });

    expect(notesOf(response)).toEqual(["price budget"]);
  });

  it.each([
    ["there are no interactions", []],
    ["the notes only contain other keywords", ["budget timeline", "delay contract"]],
  ])("returns 200 with an empty sources array when %s", async (_name, notes) => {
    const dealId = await createDeal();
    await addNotes(dealId, notes);

    const response = await ask({ question: "price" });

    expect(response.status).toBe(200);
    expect(bodyOf(response)).toMatchObject({
      answer: null,
      answeredBy: "none",
      insufficientInformation: false,
      citedInteractionIds: [],
      sources: [],
    });
  });

  it("cuts a 400-character note to a 300-character excerpt", async () => {
    const dealId = await createDeal();
    const notes = `price ${"a".repeat(394)}`;
    expect(notes).toHaveLength(400);
    await addNotes(dealId, [notes]);

    const response = await ask({ question: "price" });

    expect(bodyOf(response).sources[0]?.excerpt).toHaveLength(300);
    expect(bodyOf(response).sources[0]?.excerpt).toBe(notes.slice(0, 300));
  });

  it("returns 503 EMBEDDING_UNAVAILABLE when the question cannot be embedded", async () => {
    fake.failWith();

    const response = await ask({ question: "price" });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: {
        code: "EMBEDDING_UNAVAILABLE",
        message: "Semantic search is unavailable: the question could not be embedded",
      },
    });
  });

  it("returns 404 for GET /ask", async () => {
    const response = await request(app).get("/ask");

    expect(response.status).toBe(404);
    expect(bodyOf(response).error.code).toBe("NOT_FOUND");
  });
});

describe("PrismaAskRepository.searchInteractions", () => {
  it("returns occurredAt as a Date, not the raw string from the query", async () => {
    const dealId = await createDeal();
    await addNotes(dealId, ["price"]);

    const [row] = await new PrismaAskRepository(prisma).searchInteractions({
      embedding: fakeEmbedding("price"),
      dealId: null,
      maxDistance: 0.75,
      limit: 5,
    });

    expect(row?.occurredAt).toBeInstanceOf(Date);
    expect(row?.occurredAt).toEqual(new Date("2026-02-03T04:05:06Z"));
  });
});

describe("POST /ask validation", () => {
  it.each([
    ["a missing question", {}, "question"],
    ["a non-string question", { question: 42 }, "question"],
    ["a question of 2 characters after trimming", { question: "  ab  " }, "question"],
    ["a question of 501 characters", { question: "a".repeat(501) }, "question"],
    ["an invalid dealId", { question: "price", dealId: "not-a-uuid" }, "dealId"],
    ["a null dealId", { question: "price", dealId: null }, "dealId"],
    ["limit 0", { question: "price", limit: 0 }, "limit"],
    ["limit 11", { question: "price", limit: 11 }, "limit"],
    ["a non-integer limit", { question: "price", limit: 2.5 }, "limit"],
    ["a string limit", { question: "price", limit: "5" }, "limit"],
    ["an unknown field", { question: "price", foo: 1 }, undefined],
    ["a JSON array body", [{ question: "price" }], undefined],
  ])("returns 400 VALIDATION_ERROR for %s", async (_name, body, field) => {
    const response = await ask(body);

    expect(response.status).toBe(400);
    expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
    expect(bodyOf(response).error.message).toBe("Invalid request body");
    if (field !== undefined) {
      const details = bodyOf(response).error.details as { path: string[] }[];
      expect(details[0]?.path).toEqual([field]);
    }
    expect(fake.calls).toEqual([]);
  });

  it.each([
    ["a question of exactly 3 characters after trimming", { question: "  abc " }],
    ["a question of exactly 500 characters", { question: "a".repeat(500) }],
    ["limit 1", { question: "price", limit: 1 }],
    ["limit 10", { question: "price", limit: 10 }],
  ])("accepts %s", async (_name, body) => {
    const response = await ask(body);

    expect(response.status).toBe(200);
  });
});
