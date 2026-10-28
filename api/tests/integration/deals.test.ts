import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { createTestPrisma, resetDatabase } from "./database.js";
import { bodyOf } from "./http.js";
import { loadTestConfig } from "./test-env.js";

const config = loadTestConfig();
const container = createContainer(config);
const app = createApp(container.controllers);
const prisma = createTestPrisma(config.databaseUrl);

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await Promise.all([container.disconnect(), prisma.$disconnect()]);
});

async function createCompany(name = "Acme"): Promise<string> {
  return (await prisma.company.create({ data: { name } })).id;
}

async function createDeal(
  companyId: string,
  overrides: { title?: string; stage?: "LEAD" | "WON" | "LOST" | "QUALIFIED"; day?: number; closedAt?: Date | null } = {},
): Promise<string> {
  const deal = await prisma.deal.create({
    data: {
      companyId,
      title: overrides.title ?? "Deal",
      value: 100,
      stage: overrides.stage ?? "LEAD",
      closedAt: overrides.closedAt ?? null,
      createdAt: new Date(Date.UTC(2026, 0, overrides.day ?? 1)),
    },
  });
  return deal.id;
}

async function createInteraction(dealId: string): Promise<string> {
  return (await prisma.interaction.create({ data: { dealId, type: "NOTE", notes: "n" } })).id;
}

describe("migration add_deals_and_interactions", () => {
  it("has exactly one folder, sorted after the previous migration, with the expected SQL", () => {
    const dir = resolve(import.meta.dirname, "../../prisma/migrations");
    const matches = readdirSync(dir).filter((name) => name.endsWith("_add_deals_and_interactions"));
    expect(matches).toHaveLength(1);
    const folder = matches[0] ?? "";
    expect(folder > "20261028120000_add_companies_and_contacts").toBe(true);
    const sql = readFileSync(resolve(dir, folder, "migration.sql"), "utf8");
    expect(sql).toContain('CREATE TYPE "DealStage"');
    expect(sql).toContain('CREATE TYPE "InteractionType"');
    expect(sql).toContain("DECIMAL(12,2)");
    expect(sql).toContain('"expectedCloseDate" DATE,');
    expect(sql.match(/ON DELETE CASCADE/g)).toHaveLength(2);
    expect(sql).not.toMatch(/vector|embedding/i);
  });
});

describe("POST /companies/:companyId/deals", () => {
  it("creates a deal with defaults", async () => {
    const companyId = await createCompany();
    const before = Date.now();

    const response = await request(app)
      .post(`/companies/${companyId}/deals`)
      .send({ title: "Renewal", value: 1000 });

    expect(response.status).toBe(201);
    expect(bodyOf(response)).toMatchObject({
      companyId,
      title: "Renewal",
      value: 1000,
      stage: "LEAD",
      expectedCloseDate: null,
      closedAt: null,
    });
    expect(bodyOf(response).id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(bodyOf(response).createdAt)).toBeGreaterThanOrEqual(before - 1000);
    expect(Date.parse(bodyOf(response).updatedAt)).not.toBeNaN();
  });

  it("trims the title, returns the value as a number and round-trips the date", async () => {
    const companyId = await createCompany();

    const response = await request(app).post(`/companies/${companyId}/deals`).send({
      title: "  Big deal ",
      value: 48500.5,
      stage: "PROPOSAL",
      expectedCloseDate: "2026-12-31",
    });

    expect(response.status).toBe(201);
    const expected = {
      title: "Big deal",
      value: 48500.5,
      stage: "PROPOSAL",
      expectedCloseDate: "2026-12-31",
      closedAt: null,
    };
    expect(bodyOf(response)).toMatchObject(expected);
    const fetched = await request(app).get(`/deals/${bodyOf(response).id}`);
    expect(bodyOf(fetched)).toMatchObject(expected);
  });

  it.each(["WON", "LOST"])("sets closedAt when created as %s", async (stage) => {
    const companyId = await createCompany();
    const before = Date.now();

    const response = await request(app)
      .post(`/companies/${companyId}/deals`)
      .send({ title: "T", value: 1, stage });

    const after = Date.now();
    expect(response.status).toBe(201);
    const closedAt = Date.parse(bodyOf(response).closedAt ?? "");
    expect(closedAt).toBeGreaterThanOrEqual(before);
    expect(closedAt).toBeLessThanOrEqual(after);
  });

  it.each([0, 0.01, 12.3, 9_999_999_999.99])("accepts and returns value %s", async (value) => {
    const companyId = await createCompany();

    const response = await request(app)
      .post(`/companies/${companyId}/deals`)
      .send({ title: "T", value });

    expect(response.status).toBe(201);
    expect(bodyOf(response).value).toBe(value);
  });

  it("accepts a 200-character title and a past leap day", async () => {
    const companyId = await createCompany();

    const response = await request(app)
      .post(`/companies/${companyId}/deals`)
      .send({ title: "a".repeat(200), value: 1, expectedCloseDate: "2024-02-29" });

    expect(response.status).toBe(201);
    expect(bodyOf(response).expectedCloseDate).toBe("2024-02-29");
  });

  const validBase = { title: "T", value: 1 };
  it.each<[string, object]>([
    ["an empty object", {}],
    ["an empty title", { title: "", value: 1 }],
    ["a whitespace title", { title: "   ", value: 1 }],
    ["a 201-character title", { title: "a".repeat(201), value: 1 }],
    ["a lowercase stage", { ...validBase, stage: "won" }],
    ["a null stage", { ...validBase, stage: null }],
    ["a negative value", { ...validBase, value: -0.01 }],
    ["a value over the maximum", { ...validBase, value: 10_000_000_000 }],
    ["three decimals", { ...validBase, value: 12.345 }],
    ["float noise", { ...validBase, value: 0.30000000000000004 }],
    ["a string value", { ...validBase, value: "100" }],
    ["a null value", { ...validBase, value: null }],
    ["a missing value", { title: "T" }],
    ["an impossible date", { ...validBase, expectedCloseDate: "2026-02-30" }],
    ["month 13", { ...validBase, expectedCloseDate: "2026-13-01" }],
    ["a day-first date", { ...validBase, expectedCloseDate: "31-12-2026" }],
    ["a datetime date", { ...validBase, expectedCloseDate: "2026-12-31T00:00:00Z" }],
    ["a companyId", { ...validBase, companyId: randomUUID() }],
    ["a closedAt", { ...validBase, closedAt: "2026-01-01T00:00:00Z" }],
    ["an id", { ...validBase, id: randomUUID() }],
    ["an unknown key", { ...validBase, extra: true }],
    ["a JSON array", []],
  ])("returns 400 and creates nothing for %s", async (_name, body) => {
    const companyId = await createCompany();

    const response = await request(app).post(`/companies/${companyId}/deals`).send(body);

    expect(response.status).toBe(400);
    expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(bodyOf(response).error.details)).toBe(true);
    expect(await prisma.deal.count()).toBe(0);
  });

  it("returns 400 when there is no body", async () => {
    const companyId = await createCompany();

    const response = await request(app).post(`/companies/${companyId}/deals`);

    expect(response.status).toBe(400);
    expect(await prisma.deal.count()).toBe(0);
  });

  it("returns 400 for an invalid company id", async () => {
    const response = await request(app).post("/companies/not-a-uuid/deals").send(validBase);

    expect(response.status).toBe(400);
  });

  it("returns 404 and creates nothing when the company does not exist", async () => {
    const missing = randomUUID();

    const response = await request(app).post(`/companies/${missing}/deals`).send(validBase);

    expect(response.status).toBe(404);
    expect(bodyOf(response).error).toMatchObject({
      code: "NOT_FOUND",
      message: `Company ${missing} not found`,
    });
    expect(await prisma.deal.count()).toBe(0);
  });
});

describe("GET /companies/:companyId/deals", () => {
  it("returns only that company's deals, newest first, with pagination", async () => {
    const companyId = await createCompany();
    const otherId = await createCompany("Other");
    const first = await createDeal(companyId, { title: "A", day: 1 });
    const second = await createDeal(companyId, { title: "B", day: 2 });
    const third = await createDeal(companyId, { title: "C", day: 3 });
    await createDeal(otherId, { title: "X", day: 4 });

    const page1 = await request(app).get(`/companies/${companyId}/deals?page=1&pageSize=2`);
    const page2 = await request(app).get(`/companies/${companyId}/deals?page=2&pageSize=2`);

    expect(page1.status).toBe(200);
    expect(bodyOf(page1).data.map((d) => d.id)).toEqual([third, second]);
    expect(bodyOf(page1).meta).toEqual({ page: 1, pageSize: 2, total: 3 });
    expect(bodyOf(page2).data.map((d) => d.id)).toEqual([first]);
  });

  it("breaks createdAt ties by id descending", async () => {
    const companyId = await createCompany();
    const ids = [
      await createDeal(companyId, { day: 5 }),
      await createDeal(companyId, { day: 5 }),
      await createDeal(companyId, { day: 5 }),
    ];

    const response = await request(app).get(`/companies/${companyId}/deals`);

    expect(bodyOf(response).data.map((d) => d.id)).toEqual([...ids].sort().reverse());
  });

  it("returns an empty list for a company without deals", async () => {
    const companyId = await createCompany();

    const response = await request(app).get(`/companies/${companyId}/deals`);

    expect(response.status).toBe(200);
    expect(bodyOf(response).data).toEqual([]);
    expect(bodyOf(response).meta.total).toBe(0);
  });

  it("returns 400 for page 0 and for an invalid company id", async () => {
    const companyId = await createCompany();

    expect((await request(app).get(`/companies/${companyId}/deals?page=0`)).status).toBe(400);
    expect((await request(app).get("/companies/not-a-uuid/deals")).status).toBe(400);
  });

  it("returns 404 when the company does not exist", async () => {
    const missing = randomUUID();

    const response = await request(app).get(`/companies/${missing}/deals`);

    expect(response.status).toBe(404);
    expect(bodyOf(response).error.message).toBe(`Company ${missing} not found`);
  });
});

describe("GET /deals", () => {
  it("returns deals across companies, newest first", async () => {
    const a = await createCompany("A");
    const b = await createCompany("B");
    const older = await createDeal(a, { day: 1 });
    const newer = await createDeal(b, { day: 2 });

    const response = await request(app).get("/deals");

    expect(response.status).toBe(200);
    expect(bodyOf(response).data.map((d) => d.id)).toEqual([newer, older]);
    expect(bodyOf(response).meta).toEqual({ page: 1, pageSize: 20, total: 2 });
  });

  it("filters by stage, by company and by both, counting only filtered rows", async () => {
    const a = await createCompany("A");
    const b = await createCompany("B");
    await createDeal(a, { stage: "WON", day: 1 });
    const wonA = await createDeal(a, { stage: "WON", day: 2 });
    await createDeal(a, { stage: "LEAD", day: 3 });
    await createDeal(b, { stage: "WON", day: 4 });

    const byStage = await request(app).get("/deals?stage=WON");
    const byCompany = await request(app).get(`/deals?companyId=${a}`);
    const both = await request(app).get(`/deals?stage=WON&companyId=${a}&pageSize=1`);

    expect(bodyOf(byStage).meta.total).toBe(3);
    expect(bodyOf(byStage).data.every((d) => d.stage === "WON")).toBe(true);
    expect(bodyOf(byCompany).meta.total).toBe(3);
    expect(bodyOf(byCompany).data.every((d) => d.companyId === a)).toBe(true);
    expect(bodyOf(both).meta.total).toBe(2);
    expect(bodyOf(both).data.map((d) => d.id)).toEqual([wonA]);
  });

  it("returns 200 with an empty list for a company id that does not exist", async () => {
    const response = await request(app).get(`/deals?companyId=${randomUUID()}`);

    expect(response.status).toBe(200);
    expect(bodyOf(response).data).toEqual([]);
    expect(bodyOf(response).meta.total).toBe(0);
  });

  it("returns an empty page past the end with the correct total", async () => {
    await createDeal(await createCompany());

    const response = await request(app).get("/deals?page=5");

    expect(response.status).toBe(200);
    expect(bodyOf(response).data).toEqual([]);
    expect(bodyOf(response).meta.total).toBe(1);
  });

  it.each([
    "?stage=won",
    "?stage=",
    "?stage=WON&stage=LOST",
    "?companyId=not-a-uuid",
    "?companyId=",
    "?pageSize=101",
  ])("returns 400 for %s", async (query) => {
    const response = await request(app).get(`/deals${query}`);

    expect(response.status).toBe(400);
    expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
  });

  it("ignores unknown query keys", async () => {
    expect((await request(app).get("/deals?foo=bar")).status).toBe(200);
  });
});

describe("GET /deals/:id", () => {
  it("returns the deal in the API shape", async () => {
    const dealId = await createDeal(await createCompany());

    const response = await request(app).get(`/deals/${dealId}`);

    expect(response.status).toBe(200);
    expect(Object.keys(bodyOf(response)).sort()).toEqual(
      [
        "id",
        "companyId",
        "title",
        "value",
        "stage",
        "expectedCloseDate",
        "closedAt",
        "createdAt",
        "updatedAt",
      ].sort(),
    );
    expect(bodyOf(response).value).toBe(100);
  });

  it("returns 404 for a missing deal and the nil UUID", async () => {
    const missing = randomUUID();

    const response = await request(app).get(`/deals/${missing}`);

    expect(response.status).toBe(404);
    expect(bodyOf(response).error.message).toBe(`Deal ${missing} not found`);
    expect((await request(app).get("/deals/00000000-0000-0000-0000-000000000000")).status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    expect((await request(app).get("/deals/not-a-uuid")).status).toBe(400);
  });
});

describe("PATCH /deals/:id", () => {
  it("changes only the given field", async () => {
    const companyId = await createCompany();
    const created = await request(app).post(`/companies/${companyId}/deals`).send({
      title: "Old",
      value: 50,
      stage: "QUALIFIED",
      expectedCloseDate: "2026-05-05",
    });
    const id = bodyOf(created).id;

    const response = await request(app).patch(`/deals/${id}`).send({ title: "New" });

    expect(response.status).toBe(200);
    expect(bodyOf(response)).toMatchObject({
      title: "New",
      value: 50,
      stage: "QUALIFIED",
      expectedCloseDate: "2026-05-05",
      closedAt: null,
    });
  });

  it("clears expectedCloseDate with null and sets value to 0", async () => {
    const companyId = await createCompany();
    const created = await request(app)
      .post(`/companies/${companyId}/deals`)
      .send({ title: "T", value: 5, expectedCloseDate: "2026-05-05" });
    const id = bodyOf(created).id;

    const cleared = await request(app).patch(`/deals/${id}`).send({ expectedCloseDate: null });
    const zeroed = await request(app).patch(`/deals/${id}`).send({ value: 0 });

    expect(bodyOf(cleared).expectedCloseDate).toBeNull();
    expect(bodyOf(zeroed).value).toBe(0);
  });

  it("sets closedAt when moving from an open stage to WON", async () => {
    const dealId = await createDeal(await createCompany());

    const response = await request(app).patch(`/deals/${dealId}`).send({ stage: "WON" });

    expect(bodyOf(response).closedAt).not.toBeNull();
    expect(bodyOf(await request(app).get(`/deals/${dealId}`)).closedAt).not.toBeNull();
  });

  it.each([
    ["WON", "NEGOTIATION"],
    ["LOST", "QUALIFIED"],
  ] as const)("clears closedAt when moving from %s to %s", async (from, to) => {
    const dealId = await createDeal(await createCompany(), { stage: from, closedAt: new Date() });

    const response = await request(app).patch(`/deals/${dealId}`).send({ stage: to });

    expect(bodyOf(response).closedAt).toBeNull();
    expect(bodyOf(await request(app).get(`/deals/${dealId}`)).closedAt).toBeNull();
  });

  it("moves closedAt forward when switching from WON to LOST", async () => {
    const closedAt = new Date("2026-01-01T00:00:00Z");
    const dealId = await createDeal(await createCompany(), { stage: "WON", closedAt });

    const response = await request(app).patch(`/deals/${dealId}`).send({ stage: "LOST" });

    expect(Date.parse(bodyOf(response).closedAt ?? "")).toBeGreaterThan(closedAt.getTime());
  });

  it.each([{ stage: "WON" }, { title: "x" }])(
    "keeps closedAt unchanged for %j on a WON deal",
    async (patch) => {
      const closedAt = new Date("2026-01-01T00:00:00.000Z");
      const dealId = await createDeal(await createCompany(), { stage: "WON", closedAt });

      const response = await request(app).patch(`/deals/${dealId}`).send(patch);

      expect(bodyOf(response).closedAt).toBe(closedAt.toISOString());
    },
  );

  it("keeps closedAt null when moving between open stages", async () => {
    const dealId = await createDeal(await createCompany());

    const response = await request(app).patch(`/deals/${dealId}`).send({ stage: "PROPOSAL" });

    expect(bodyOf(response).closedAt).toBeNull();
  });

  it.each<[string, object]>([
    ["an empty object", {}],
    ["an empty title", { title: "" }],
    ["a negative value", { value: -1 }],
    ["three decimals", { value: 1.234 }],
    ["a null value", { value: null }],
    ["an unknown stage", { stage: "CLOSED" }],
    ["a null stage", { stage: null }],
    ["a companyId", { companyId: randomUUID() }],
    ["a null closedAt", { closedAt: null }],
    ["a closedAt date", { closedAt: "2026-01-01T00:00:00Z" }],
    ["an impossible date", { expectedCloseDate: "2026-02-30" }],
    ["an unknown key", { extra: 1 }],
  ])("returns 400 and leaves the deal unchanged for %s", async (_name, body) => {
    const companyId = await createCompany();
    const dealId = await createDeal(companyId, { title: "Original" });

    const response = await request(app).patch(`/deals/${dealId}`).send(body);

    expect(response.status).toBe(400);
    const stored = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } });
    expect(stored).toMatchObject({ companyId, title: "Original", stage: "LEAD" });
  });

  it("returns 404 for a missing deal, with and without stage, and creates nothing", async () => {
    const missing = randomUUID();

    const withStage = await request(app).patch(`/deals/${missing}`).send({ stage: "WON" });
    const withoutStage = await request(app).patch(`/deals/${missing}`).send({ title: "x" });

    expect(withStage.status).toBe(404);
    expect(withoutStage.status).toBe(404);
    expect(bodyOf(withStage).error.message).toBe(`Deal ${missing} not found`);
    expect(await prisma.deal.count()).toBe(0);
  });

  it("returns 400 for an invalid id", async () => {
    expect((await request(app).patch("/deals/not-a-uuid").send({ title: "x" })).status).toBe(400);
  });
});

describe("DELETE /deals/:id", () => {
  it("deletes the deal, keeps the company and returns 404 afterwards", async () => {
    const companyId = await createCompany();
    const dealId = await createDeal(companyId);

    const response = await request(app).delete(`/deals/${dealId}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect((await request(app).get(`/deals/${dealId}`)).status).toBe(404);
    expect(await prisma.company.count({ where: { id: companyId } })).toBe(1);
  });

  it("returns 404 for a missing deal and 400 for an invalid id", async () => {
    expect((await request(app).delete(`/deals/${randomUUID()}`)).status).toBe(404);
    expect((await request(app).delete("/deals/not-a-uuid")).status).toBe(400);
  });
});

describe("cascade deletes", () => {
  it("deleting a company removes its deals and their interactions only", async () => {
    const a = await createCompany("A");
    const b = await createCompany("B");
    const a1 = await createDeal(a);
    const a2 = await createDeal(a);
    const b1 = await createDeal(b);
    const aInteractions = [
      await createInteraction(a1),
      await createInteraction(a1),
      await createInteraction(a2),
    ];
    const bInteraction = await createInteraction(b1);

    const response = await request(app).delete(`/companies/${a}`);

    expect(response.status).toBe(204);
    for (const id of [a1, a2]) {
      expect((await request(app).get(`/deals/${id}`)).status).toBe(404);
    }
    for (const id of aInteractions) {
      expect((await request(app).get(`/interactions/${id}`)).status).toBe(404);
    }
    expect(await prisma.deal.count({ where: { companyId: a } })).toBe(0);
    expect(await prisma.interaction.count({ where: { dealId: { in: [a1, a2] } } })).toBe(0);
    expect((await request(app).get(`/deals/${b1}`)).status).toBe(200);
    expect((await request(app).get(`/interactions/${bInteraction}`)).status).toBe(200);
  });

  it("deleting a deal removes its interactions only", async () => {
    const companyId = await createCompany();
    const x = await createDeal(companyId);
    const y = await createDeal(companyId);
    const xInteractions = [await createInteraction(x), await createInteraction(x)];
    const yInteraction = await createInteraction(y);

    const response = await request(app).delete(`/deals/${x}`);

    expect(response.status).toBe(204);
    for (const id of xInteractions) {
      expect((await request(app).get(`/interactions/${id}`)).status).toBe(404);
    }
    expect(await prisma.interaction.count({ where: { dealId: x } })).toBe(0);
    expect((await request(app).get(`/interactions/${yInteraction}`)).status).toBe(200);
    expect((await request(app).get(`/deals/${y}`)).status).toBe(200);
    expect(await prisma.company.count({ where: { id: companyId } })).toBe(1);
  });
});
