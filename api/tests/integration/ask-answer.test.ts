import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../../src/app.js";
import { FakeEmbeddingProvider } from "../support/fake-embedding-provider.js";
import { FakeLlmClient } from "../support/fake-llm-client.js";
import { createTestPrisma, resetDatabase } from "./database.js";
import { bodyOf } from "./http.js";
import { createTestContainer } from "./test-container.js";
import { loadTestConfig } from "./test-env.js";

const config = loadTestConfig();
const fake = new FakeEmbeddingProvider();
const fakeLlm = new FakeLlmClient();
const logger = { warn: vi.fn() };
const container = createTestContainer(config, {
  embeddingProvider: fake,
  logger,
  llmClient: fakeLlm,
});
const app = createApp(container.controllers);
const prisma = createTestPrisma(config.databaseUrl);

beforeEach(async () => {
  await resetDatabase(prisma);
  fake.reset();
  fakeLlm.reset();
  logger.warn.mockClear();
});

afterAll(async () => {
  await Promise.all([container.disconnect(), prisma.$disconnect()]);
});

async function createDealWithNotes(notes: string[]): Promise<string[]> {
  const company = await prisma.company.create({ data: { name: "Acme" } });
  const deal = await prisma.deal.create({
    data: { companyId: company.id, title: "Renewal", value: 1 },
  });
  const ids: string[] = [];
  for (const text of notes) {
    const row = await prisma.interaction.create({
      data: {
        dealId: deal.id,
        type: "EMAIL",
        notes: text,
        occurredAt: new Date("2026-02-03T04:05:06Z"),
      },
    });
    ids.push(row.id);
  }
  await container.interactionEmbeddings.backfillMissing();
  fake.reset();
  return ids;
}

function ask(body: unknown) {
  return request(app)
    .post("/ask")
    .send(body as object);
}

describe("POST /ask with an LLM client", () => {
  it("returns the generated answer with the cited interaction ids and labelled sources", async () => {
    const [budgetId, priceId] = await createDealWithNotes(["price budget", "price"]);
    fakeLlm.respondWith({
      answer: "Acme discussed price [S1][S2].",
      citedSources: ["S1", "S2", "S7"],
      insufficientInformation: false,
    });

    const response = await ask({ question: "price" });

    expect(response.status).toBe(200);
    const body = bodyOf(response);
    expect(body.answeredBy).toBe("llm");
    expect(body.answer).toBe("Acme discussed price [S1][S2].");
    expect(body.insufficientInformation).toBe(false);
    // S1 is "price" (similarity 1), S2 is "price budget".
    expect(body.citedInteractionIds).toEqual([priceId, budgetId]);
    expect(body.sources.map((source) => source.label)).toEqual(["S1", "S2"]);
    expect(body.sources.every((source) => !("notes" in source))).toBe(true);
    expect(fakeLlm.requests).toHaveLength(1);
    expect(fakeLlm.requests[0]?.tool.name).toBe("submit_answer");
    expect(fakeLlm.requests[0]?.prompt).toContain("<question>\nprice\n</question>");
  });

  it("does not call the LLM when no interactions match", async () => {
    await createDealWithNotes(["budget timeline"]);

    const response = await ask({ question: "price" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      answer: null,
      answeredBy: "none",
      insufficientInformation: false,
      citedInteractionIds: [],
      sources: [],
    });
    expect(fakeLlm.requests).toEqual([]);
  });

  it("returns 200 with sources only and one warning when the LLM fails", async () => {
    await createDealWithNotes(["price"]);
    fakeLlm.failWith();

    const response = await ask({ question: "price" });

    expect(response.status).toBe(200);
    const body = bodyOf(response);
    expect(body).toMatchObject({
      answer: null,
      answeredBy: "none",
      insufficientInformation: false,
      citedInteractionIds: [],
    });
    expect(body.sources).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
