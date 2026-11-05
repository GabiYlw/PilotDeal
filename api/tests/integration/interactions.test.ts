import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createTestContainer } from "./test-container.js";
import { createTestPrisma, resetDatabase } from "./database.js";
import { bodyOf } from "./http.js";
import { loadTestConfig } from "./test-env.js";

const config = loadTestConfig();
const container = createTestContainer(config);
const app = createApp(container.controllers);
const prisma = createTestPrisma(config.databaseUrl);

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await Promise.all([container.disconnect(), prisma.$disconnect()]);
});

async function createDeal(): Promise<string> {
  const company = await prisma.company.create({ data: { name: "Acme" } });
  return (await prisma.deal.create({ data: { companyId: company.id, title: "D", value: 1 } })).id;
}

async function createInteraction(dealId: string, occurredAt: Date, notes = "n"): Promise<string> {
  const row = await prisma.interaction.create({
    data: { dealId, type: "NOTE", notes, occurredAt },
  });
  return row.id;
}

const hourAhead = () => new Date(Date.now() + 3_600_000).toISOString();

describe("POST /deals/:dealId/interactions", () => {
  it("creates an interaction with trimmed notes and occurredAt defaulting to now", async () => {
    const dealId = await createDeal();
    const before = Date.now();

    const response = await request(app)
      .post(`/deals/${dealId}/interactions`)
      .send({ type: "CALL", notes: "  Discussed pricing  " });

    const after = Date.now();
    expect(response.status).toBe(201);
    expect(bodyOf(response)).toMatchObject({ dealId, type: "CALL", notes: "Discussed pricing" });
    const occurredAt = Date.parse(bodyOf(response).occurredAt);
    // The default comes from the database clock, so allow a small skew.
    expect(occurredAt).toBeGreaterThanOrEqual(before - 2000);
    expect(occurredAt).toBeLessThanOrEqual(after + 2000);
  });

  it("normalizes occurredAt to UTC", async () => {
    const dealId = await createDeal();

    const utc = await request(app)
      .post(`/deals/${dealId}/interactions`)
      .send({ type: "NOTE", notes: "x", occurredAt: "2026-01-15T10:30:00Z" });
    const offset = await request(app)
      .post(`/deals/${dealId}/interactions`)
      .send({ type: "NOTE", notes: "x", occurredAt: "2026-01-15T12:30:00+02:00" });

    expect(bodyOf(utc).occurredAt).toBe("2026-01-15T10:30:00.000Z");
    expect(bodyOf(offset).occurredAt).toBe("2026-01-15T10:30:00.000Z");
  });

  it("accepts 5000-character notes, also with surrounding spaces", async () => {
    const dealId = await createDeal();
    const notes = "a".repeat(5000);

    const plain = await request(app)
      .post(`/deals/${dealId}/interactions`)
      .send({ type: "NOTE", notes });
    const padded = await request(app)
      .post(`/deals/${dealId}/interactions`)
      .send({ type: "NOTE", notes: ` ${notes} ` });

    expect(plain.status).toBe(201);
    expect(padded.status).toBe(201);
  });

  const base = { type: "CALL", notes: "x" };
  it.each<[string, object]>([
    ["an empty object", {}],
    ["a missing type", { notes: "x" }],
    ["type SMS", { type: "SMS", notes: "x" }],
    ["a lowercase type", { type: "call", notes: "x" }],
    ["missing notes", { type: "CALL" }],
    ["empty notes", { type: "CALL", notes: "" }],
    ["whitespace notes", { type: "CALL", notes: "   " }],
    ["5001-character notes", { type: "CALL", notes: "a".repeat(5001) }],
    ["a future occurredAt", { ...base, occurredAt: hourAhead() }],
    ["a date-only occurredAt", { ...base, occurredAt: "2026-01-15" }],
    ["an occurredAt without offset", { ...base, occurredAt: "2026-01-15T10:30:00" }],
    ["a non-date occurredAt", { ...base, occurredAt: "not-a-date" }],
    ["a null occurredAt", { ...base, occurredAt: null }],
    ["an occurredAt before 1900", { ...base, occurredAt: "1899-12-31T23:59:59Z" }],
    ["a dealId", { ...base, dealId: randomUUID() }],
    ["an id", { ...base, id: randomUUID() }],
    ["an unknown key", { ...base, extra: 1 }],
    ["a JSON array", []],
  ])("returns 400 and creates nothing for %s", async (_name, body) => {
    const dealId = await createDeal();

    const response = await request(app).post(`/deals/${dealId}/interactions`).send(body);

    expect(response.status).toBe(400);
    expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.interaction.count()).toBe(0);
  });

  it("returns 400 when there is no body", async () => {
    const dealId = await createDeal();

    expect((await request(app).post(`/deals/${dealId}/interactions`)).status).toBe(400);
    expect(await prisma.interaction.count()).toBe(0);
  });

  it("returns 400 for an invalid deal id", async () => {
    expect((await request(app).post("/deals/not-a-uuid/interactions").send(base)).status).toBe(400);
  });

  it("returns 404 and creates nothing when the deal does not exist", async () => {
    const missing = randomUUID();

    const response = await request(app).post(`/deals/${missing}/interactions`).send(base);

    expect(response.status).toBe(404);
    expect(bodyOf(response).error.message).toBe(`Deal ${missing} not found`);
    expect(await prisma.interaction.count()).toBe(0);
  });
});

describe("GET /deals/:dealId/interactions", () => {
  it("returns only that deal's interactions ordered by occurredAt descending", async () => {
    const dealId = await createDeal();
    const otherDealId = await createDeal();
    // Inserted out of occurredAt order so createdAt cannot explain the result.
    const middle = await createInteraction(dealId, new Date("2026-01-02T00:00:00Z"));
    const newest = await createInteraction(dealId, new Date("2026-01-03T00:00:00Z"));
    const oldest = await createInteraction(dealId, new Date("2026-01-01T00:00:00Z"));
    await createInteraction(otherDealId, new Date("2026-01-04T00:00:00Z"));

    const response = await request(app).get(`/deals/${dealId}/interactions`);

    expect(response.status).toBe(200);
    expect(bodyOf(response).data.map((i) => i.id)).toEqual([newest, middle, oldest]);
    expect(bodyOf(response).meta).toEqual({ page: 1, pageSize: 20, total: 3 });
  });

  it("breaks occurredAt ties by id descending", async () => {
    const dealId = await createDeal();
    const at = new Date("2026-01-01T00:00:00Z");
    const ids = [
      await createInteraction(dealId, at),
      await createInteraction(dealId, at),
      await createInteraction(dealId, at),
    ];

    const response = await request(app).get(`/deals/${dealId}/interactions`);

    expect(bodyOf(response).data.map((i) => i.id)).toEqual([...ids].sort().reverse());
  });

  it("paginates with the correct total", async () => {
    const dealId = await createDeal();
    for (let day = 1; day <= 3; day += 1) {
      await createInteraction(dealId, new Date(Date.UTC(2026, 0, day)));
    }

    const response = await request(app).get(`/deals/${dealId}/interactions?page=2&pageSize=2`);

    expect(bodyOf(response).data).toHaveLength(1);
    expect(bodyOf(response).meta).toEqual({ page: 2, pageSize: 2, total: 3 });
  });

  it("returns an empty list for a deal without interactions", async () => {
    const dealId = await createDeal();

    const response = await request(app).get(`/deals/${dealId}/interactions`);

    expect(response.status).toBe(200);
    expect(bodyOf(response).data).toEqual([]);
  });

  it("returns 400 for bad pagination and an invalid id, and 404 for a missing deal", async () => {
    const dealId = await createDeal();

    expect((await request(app).get(`/deals/${dealId}/interactions?page=0`)).status).toBe(400);
    expect((await request(app).get("/deals/not-a-uuid/interactions")).status).toBe(400);
    const missing = await request(app).get(`/deals/${randomUUID()}/interactions`);
    expect(missing.status).toBe(404);
  });
});

describe("GET /interactions/:id", () => {
  it("returns the interaction in the API shape", async () => {
    const dealId = await createDeal();
    const id = await createInteraction(dealId, new Date("2026-01-01T00:00:00Z"));

    const response = await request(app).get(`/interactions/${id}`);

    expect(response.status).toBe(200);
    expect(Object.keys(bodyOf(response)).sort()).toEqual(
      ["id", "dealId", "type", "notes", "occurredAt", "createdAt", "updatedAt"].sort(),
    );
  });

  it("returns 404 for a missing interaction and 400 for an invalid id", async () => {
    const missing = randomUUID();

    const response = await request(app).get(`/interactions/${missing}`);

    expect(response.status).toBe(404);
    expect(bodyOf(response).error.message).toBe(`Interaction ${missing} not found`);
    expect((await request(app).get("/interactions/not-a-uuid")).status).toBe(400);
  });
});

describe("PATCH /interactions/:id", () => {
  it("changes only notes", async () => {
    const dealId = await createDeal();
    const id = await createInteraction(dealId, new Date("2026-01-01T00:00:00Z"), "Old");

    const response = await request(app).patch(`/interactions/${id}`).send({ notes: "Updated" });

    expect(response.status).toBe(200);
    expect(bodyOf(response)).toMatchObject({
      notes: "Updated",
      type: "NOTE",
      occurredAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("updates type and occurredAt", async () => {
    const dealId = await createDeal();
    const id = await createInteraction(dealId, new Date("2026-01-01T00:00:00Z"));

    const type = await request(app).patch(`/interactions/${id}`).send({ type: "MEETING" });
    const date = await request(app)
      .patch(`/interactions/${id}`)
      .send({ occurredAt: "2025-05-05T05:05:05Z" });

    expect(bodyOf(type).type).toBe("MEETING");
    expect(bodyOf(date).occurredAt).toBe("2025-05-05T05:05:05.000Z");
  });

  it.each<[string, object]>([
    ["an empty object", {}],
    ["empty notes", { notes: "" }],
    ["null notes", { notes: null }],
    ["type SMS", { type: "SMS" }],
    ["a future occurredAt", { occurredAt: hourAhead() }],
    ["a null occurredAt", { occurredAt: null }],
    ["a dealId", { dealId: randomUUID() }],
    ["an unknown key", { extra: 1 }],
  ])("returns 400 and leaves the interaction unchanged for %s", async (_name, body) => {
    const dealId = await createDeal();
    const id = await createInteraction(dealId, new Date("2026-01-01T00:00:00Z"), "Original");

    const response = await request(app).patch(`/interactions/${id}`).send(body);

    expect(response.status).toBe(400);
    const stored = await prisma.interaction.findUniqueOrThrow({ where: { id } });
    expect(stored).toMatchObject({ dealId, notes: "Original", type: "NOTE" });
  });

  it("returns 404 for a missing interaction and 400 for an invalid id", async () => {
    expect(
      (await request(app).patch(`/interactions/${randomUUID()}`).send({ notes: "x" })).status,
    ).toBe(404);
    expect((await request(app).patch("/interactions/not-a-uuid").send({ notes: "x" })).status).toBe(
      400,
    );
  });
});

describe("DELETE /interactions/:id", () => {
  it("deletes the interaction, keeps the deal and returns 404 afterwards", async () => {
    const dealId = await createDeal();
    const id = await createInteraction(dealId, new Date("2026-01-01T00:00:00Z"));

    const response = await request(app).delete(`/interactions/${id}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect((await request(app).get(`/interactions/${id}`)).status).toBe(404);
    expect(await prisma.deal.count({ where: { id: dealId } })).toBe(1);
  });

  it("returns 404 for a missing interaction and 400 for an invalid id", async () => {
    expect((await request(app).delete(`/interactions/${randomUUID()}`)).status).toBe(404);
    expect((await request(app).delete("/interactions/not-a-uuid")).status).toBe(400);
  });
});
