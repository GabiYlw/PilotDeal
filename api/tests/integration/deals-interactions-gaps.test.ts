import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createTestContainer } from "./test-container.js";
import { createTestPrisma, resetDatabase } from "./database.js";
import { bodyOf } from "./http.js";
import { loadTestConfig } from "./test-env.js";

// Gap-filling tests for the deals and interactions modules. Uses DATABASE_URL_TEST only.
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

async function createCompany(name = "Acme"): Promise<string> {
  return (await prisma.company.create({ data: { name } })).id;
}

async function seedDeal(
  companyId: string,
  data: { stage?: "LEAD" | "WON" | "LOST"; closedAt?: Date | null } = {},
): Promise<string> {
  return (
    await prisma.deal.create({
      data: { companyId, title: "Deal", value: 100, stage: data.stage ?? "LEAD", closedAt: data.closedAt ?? null },
    })
  ).id;
}

describe("deal closedAt transitions not covered elsewhere", () => {
  it("moves closedAt forward when switching from LOST to WON", async () => {
    const closedAt = new Date("2026-01-01T00:00:00Z");
    const id = await seedDeal(await createCompany(), { stage: "LOST", closedAt });

    const response = await request(app).patch(`/deals/${id}`).send({ stage: "WON" });

    expect(response.status).toBe(200);
    expect(Date.parse(bodyOf(response).closedAt ?? "")).toBeGreaterThan(closedAt.getTime());
  });

  it("keeps closedAt unchanged for LOST to LOST", async () => {
    const closedAt = new Date("2026-01-01T00:00:00.000Z");
    const id = await seedDeal(await createCompany(), { stage: "LOST", closedAt });

    const response = await request(app).patch(`/deals/${id}`).send({ stage: "LOST", title: "renamed" });

    expect(bodyOf(response).closedAt).toBe(closedAt.toISOString());
    expect(bodyOf(response).title).toBe("renamed");
  });

  it("sets closedAt between request start and end when moving LEAD to LOST", async () => {
    const id = await seedDeal(await createCompany());

    const before = Date.now();
    const response = await request(app).patch(`/deals/${id}`).send({ stage: "LOST" });
    const after = Date.now();

    const closedAt = Date.parse(bodyOf(response).closedAt ?? "");
    expect(closedAt).toBeGreaterThanOrEqual(before);
    expect(closedAt).toBeLessThanOrEqual(after);
  });

  it("leaves an inconsistent legacy WON row with null closedAt alone on a WON to WON patch", async () => {
    const id = await seedDeal(await createCompany(), { stage: "WON", closedAt: null });

    const response = await request(app).patch(`/deals/${id}`).send({ stage: "WON" });

    expect(bodyOf(response).closedAt).toBeNull();
  });

  it("sets closedAt for an inconsistent legacy WON row patched to LOST", async () => {
    const id = await seedDeal(await createCompany(), { stage: "WON", closedAt: null });

    const response = await request(app).patch(`/deals/${id}`).send({ stage: "LOST" });

    expect(bodyOf(response).closedAt).not.toBeNull();
  });

  it("updates closedAt and the other fields together in one stage patch", async () => {
    const id = await seedDeal(await createCompany());

    const response = await request(app)
      .patch(`/deals/${id}`)
      .send({ stage: "WON", title: "Closed deal", value: 5.5 });

    expect(bodyOf(response)).toMatchObject({ stage: "WON", title: "Closed deal", value: 5.5 });
    expect(bodyOf(response).closedAt).not.toBeNull();
  });
});

describe("deal value decimal handling", () => {
  it.each([5, 5.1, 0.99, 1234567.89, 48500.5])("round-trips value %s through POST, GET and the list", async (value) => {
    const companyId = await createCompany();

    const created = await request(app).post(`/companies/${companyId}/deals`).send({ title: "T", value });
    const fetched = await request(app).get(`/deals/${bodyOf(created).id}`);
    const listed = await request(app).get("/deals");

    expect(bodyOf(created).value).toBe(value);
    expect(typeof bodyOf(created).value).toBe("number");
    expect(bodyOf(fetched).value).toBe(value);
    expect(bodyOf(listed).data[0]?.value).toBe(value);
  });

  it("returns value as a JSON number in the raw response text (not a quoted string)", async () => {
    const companyId = await createCompany();

    const response = await request(app).post(`/companies/${companyId}/deals`).send({ title: "T", value: 48500.5 });

    expect(response.text).toContain('"value":48500.5');
  });

  it("accepts 5.10 sent as raw JSON and stores 5.1", async () => {
    const companyId = await createCompany();

    const response = await request(app)
      .post(`/companies/${companyId}/deals`)
      .set("Content-Type", "application/json")
      .send('{"title":"T","value":5.10}');

    expect(response.status).toBe(201);
    expect(bodyOf(response).value).toBe(5.1);
  });

  it("stores raw JSON -0 as 0", async () => {
    const companyId = await createCompany();

    const response = await request(app)
      .post(`/companies/${companyId}/deals`)
      .set("Content-Type", "application/json")
      .send('{"title":"T","value":-0}');

    expect(response.status).toBe(201);
    expect(bodyOf(response).value).toBe(0);
  });

  it.each(["1e-7", "1e10", "0.001", "9999999999.991", "10000000000.00"])(
    "returns 400 for raw JSON value %s",
    async (raw) => {
      const companyId = await createCompany();

      const response = await request(app)
        .post(`/companies/${companyId}/deals`)
        .set("Content-Type", "application/json")
        .send(`{"title":"T","value":${raw}}`);

      expect(response.status).toBe(400);
      expect(await prisma.deal.count()).toBe(0);
    },
  );

  it("updates value through PATCH with at most two decimals and rejects more", async () => {
    const companyId = await createCompany();
    const id = await seedDeal(companyId);

    const ok = await request(app).patch(`/deals/${id}`).send({ value: 9_999_999_999.99 });
    const bad = await request(app).patch(`/deals/${id}`).send({ value: 0.30000000000000004 });

    expect(bodyOf(ok).value).toBe(9_999_999_999.99);
    expect(bad.status).toBe(400);
  });
});

describe("expectedCloseDate date-only handling", () => {
  it.each(["1900-01-01", "2000-02-29", "2026-12-31", "2026-01-01", "9999-12-31"])(
    "round-trips %s exactly through create, get, list and company list",
    async (date) => {
      const companyId = await createCompany();

      const created = await request(app)
        .post(`/companies/${companyId}/deals`)
        .send({ title: "T", value: 1, expectedCloseDate: date });
      const fetched = await request(app).get(`/deals/${bodyOf(created).id}`);
      const listed = await request(app).get("/deals");
      const companyListed = await request(app).get(`/companies/${companyId}/deals`);

      expect(created.status).toBe(201);
      expect(bodyOf(created).expectedCloseDate).toBe(date);
      expect(bodyOf(fetched).expectedCloseDate).toBe(date);
      expect(bodyOf(listed).data[0]?.expectedCloseDate).toBe(date);
      expect(bodyOf(companyListed).data[0]?.expectedCloseDate).toBe(date);
    },
  );

  it.each(["1899-12-31", "2025-02-29", "0000-01-01", "2026-04-31", "2026-1-5", "20261231", ""])(
    "returns 400 for expectedCloseDate %j",
    async (date) => {
      const companyId = await createCompany();

      const response = await request(app)
        .post(`/companies/${companyId}/deals`)
        .send({ title: "T", value: 1, expectedCloseDate: date });

      expect(response.status).toBe(400);
      expect(await prisma.deal.count()).toBe(0);
    },
  );

  it("sets, changes and clears expectedCloseDate via PATCH", async () => {
    const id = await seedDeal(await createCompany());

    const set = await request(app).patch(`/deals/${id}`).send({ expectedCloseDate: "2026-03-01" });
    const changed = await request(app).patch(`/deals/${id}`).send({ expectedCloseDate: "2024-02-29" });
    const cleared = await request(app).patch(`/deals/${id}`).send({ expectedCloseDate: null });

    expect(bodyOf(set).expectedCloseDate).toBe("2026-03-01");
    expect(bodyOf(changed).expectedCloseDate).toBe("2024-02-29");
    expect(bodyOf(cleared).expectedCloseDate).toBeNull();
  });

  it("stores the date at UTC midnight regardless of the process time zone", async () => {
    const companyId = await createCompany();

    const created = await request(app)
      .post(`/companies/${companyId}/deals`)
      .send({ title: "T", value: 1, expectedCloseDate: "2026-06-15" });

    const rows = await prisma.$queryRaw<{ d: string }[]>`SELECT "expectedCloseDate"::text AS d FROM "Deal" WHERE id = ${bodyOf(created).id}::uuid`;
    expect(rows[0]?.d).toBe("2026-06-15");
  });
});

describe("deal response shape", () => {
  it("returns exactly the documented keys and no embedded relations", async () => {
    const companyId = await createCompany();
    const id = await seedDeal(companyId);
    await prisma.interaction.create({ data: { dealId: id, type: "NOTE", notes: "n" } });

    const response = await request(app).get(`/deals/${id}`);

    expect(Object.keys(response.body as object).sort()).toEqual(
      ["closedAt", "companyId", "createdAt", "expectedCloseDate", "id", "stage", "title", "updatedAt", "value"].sort(),
    );
  });

  it("returns ISO 8601 strings for createdAt and updatedAt", async () => {
    const companyId = await createCompany();

    const response = await request(app).post(`/companies/${companyId}/deals`).send({ title: "T", value: 1 });

    expect(bodyOf(response).createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(bodyOf(response).updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("advances updatedAt on PATCH but keeps createdAt", async () => {
    const companyId = await createCompany();
    const created = await request(app).post(`/companies/${companyId}/deals`).send({ title: "T", value: 1 });
    await new Promise((r) => setTimeout(r, 15));

    const patched = await request(app).patch(`/deals/${bodyOf(created).id}`).send({ title: "U" });

    expect(bodyOf(patched).createdAt).toBe(bodyOf(created).createdAt);
    expect(Date.parse(bodyOf(patched).updatedAt)).toBeGreaterThan(Date.parse(bodyOf(created).updatedAt));
  });

  it("reports validation details as an array of path and message", async () => {
    const companyId = await createCompany();

    const response = await request(app).post(`/companies/${companyId}/deals`).send({ title: "", value: -1 });

    const details = bodyOf(response).error.details as { path: unknown[]; message: string }[];
    expect([...new Set(details.map((d) => d.path[0]))].sort()).toEqual(["title", "value"]);
    expect(details.every((d) => typeof d.message === "string")).toBe(true);
  });
});

describe("validation order and filters", () => {
  it("validates route params before the body", async () => {
    const response = await request(app).post("/companies/not-a-uuid/deals").send({ bad: true });

    expect(response.status).toBe(400);
    const details = bodyOf(response).error.details as { path: unknown[] }[];
    expect(details[0]?.path[0]).toBe("companyId");
  });

  it("validates route params before the query on GET /companies/:id/deals", async () => {
    const response = await request(app).get("/companies/not-a-uuid/deals?page=0");

    const details = bodyOf(response).error.details as { path: unknown[] }[];
    expect(details[0]?.path[0]).toBe("companyId");
  });

  it("ignores ?stage on the nested company deal list", async () => {
    const companyId = await createCompany();
    await seedDeal(companyId, { stage: "WON" });
    await seedDeal(companyId, { stage: "LEAD" });

    const response = await request(app).get(`/companies/${companyId}/deals?stage=WON`);

    expect(response.status).toBe(200);
    expect(bodyOf(response).meta.total).toBe(2);
  });

  it.each(["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const)(
    "filters GET /deals by stage %s",
    async (stage) => {
      const companyId = await createCompany();
      for (const s of ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const) {
        await prisma.deal.create({ data: { companyId, title: s, value: 1, stage: s } });
      }

      const response = await request(app).get(`/deals?stage=${stage}`);

      expect(bodyOf(response).data.map((d) => d.stage)).toEqual([stage]);
      expect(bodyOf(response).meta.total).toBe(1);
    },
  );

  it("returns empty data when stage and company filters match nothing together", async () => {
    const a = await createCompany("A");
    const b = await createCompany("B");
    await seedDeal(a, { stage: "WON" });
    await seedDeal(b, { stage: "LEAD" });

    const response = await request(app).get(`/deals?stage=WON&companyId=${b}`);

    expect(bodyOf(response).data).toEqual([]);
    expect(bodyOf(response).meta.total).toBe(0);
  });

  it("paginates a filtered list with total of the filtered rows only", async () => {
    const a = await createCompany("A");
    for (let i = 0; i < 5; i++) await seedDeal(a, { stage: "WON", closedAt: new Date() });
    await seedDeal(a, { stage: "LEAD" });

    const page2 = await request(app).get("/deals?stage=WON&page=2&pageSize=2");
    const page4 = await request(app).get("/deals?stage=WON&page=4&pageSize=2");

    expect(bodyOf(page2).data).toHaveLength(2);
    expect(bodyOf(page2).meta).toEqual({ page: 2, pageSize: 2, total: 5 });
    expect(bodyOf(page4).data).toEqual([]);
    expect(bodyOf(page4).meta.total).toBe(5);
  });

  it.each(["?page=0", "?pageSize=0", "?page=abc", "?page=-1"])("returns 400 for GET /deals%s", async (q) => {
    expect((await request(app).get(`/deals${q}`)).status).toBe(400);
  });

  it("accepts pageSize 100 on GET /deals", async () => {
    expect((await request(app).get("/deals?pageSize=100")).status).toBe(200);
  });

  it("returns 404 on every nested route for the nil UUID", async () => {
    const nil = "00000000-0000-0000-0000-000000000000";

    const statuses = await Promise.all([
      request(app).get(`/companies/${nil}/deals`),
      request(app).get(`/deals/${nil}/interactions`),
      request(app).get(`/interactions/${nil}`),
      request(app).delete(`/interactions/${nil}`),
    ]);

    expect(statuses.map((r) => r.status)).toEqual([404, 404, 404, 404]);
  });
});

describe("cascades enforced by the database foreign keys", () => {
  it("removes deals and interactions when the company row is deleted directly with Prisma", async () => {
    const companyId = await createCompany();
    const dealId = await seedDeal(companyId);
    await prisma.interaction.create({ data: { dealId, type: "CALL", notes: "n" } });

    await prisma.company.delete({ where: { id: companyId } });

    expect(await prisma.deal.count()).toBe(0);
    expect(await prisma.interaction.count()).toBe(0);
  });

  it("removes interactions of a WON deal when the deal is deleted via the API", async () => {
    const companyId = await createCompany();
    const dealId = await seedDeal(companyId, { stage: "WON", closedAt: new Date() });
    await prisma.interaction.create({ data: { dealId, type: "NOTE", notes: "n" } });

    const response = await request(app).delete(`/deals/${dealId}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(await prisma.interaction.count()).toBe(0);
    expect(await prisma.company.count()).toBe(1);
  });

  it("rejects inserting a deal or interaction that points at a missing parent at the DB level", async () => {
    await expect(
      prisma.deal.create({ data: { companyId: randomUUID(), title: "x", value: 1 } }),
    ).rejects.toThrow();
    await expect(
      prisma.interaction.create({ data: { dealId: randomUUID(), type: "NOTE", notes: "x" } }),
    ).rejects.toThrow();
  });
});

describe("interactions edge cases", () => {
  async function createDealId(): Promise<string> {
    return seedDeal(await createCompany());
  }

  it("accepts occurredAt equal to a moment just before now and rejects one a minute ahead", async () => {
    const dealId = await createDealId();
    const justBefore = new Date(Date.now() - 1000).toISOString();
    const minuteAhead = new Date(Date.now() + 60_000).toISOString();

    const ok = await request(app).post(`/deals/${dealId}/interactions`).send({ type: "NOTE", notes: "x", occurredAt: justBefore });
    const bad = await request(app).post(`/deals/${dealId}/interactions`).send({ type: "NOTE", notes: "x", occurredAt: minuteAhead });

    expect(ok.status).toBe(201);
    expect(bad.status).toBe(400);
    expect(await prisma.interaction.count()).toBe(1);
  });

  it("rejects a future occurredAt expressed with a numeric offset", async () => {
    const dealId = await createDealId();
    const ahead = new Date(Date.now() + 2 * 3_600_000);
    // same instant, written in +05:00 local wall time
    const shifted = new Date(ahead.getTime() + 5 * 3_600_000).toISOString().replace("Z", "+05:00");

    const response = await request(app)
      .post(`/deals/${dealId}/interactions`)
      .send({ type: "NOTE", notes: "x", occurredAt: shifted });

    expect(response.status).toBe(400);
  });

  it("accepts a past occurredAt whose local wall time looks like the future but is in the past via offset", async () => {
    const dealId = await createDealId();
    // wall clock 3h ahead of UTC-now with a +05:00 offset is 2h in the past in UTC.
    const wall = new Date(Date.now() + 3 * 3_600_000).toISOString().replace("Z", "+05:00");

    const response = await request(app)
      .post(`/deals/${dealId}/interactions`)
      .send({ type: "NOTE", notes: "x", occurredAt: wall });

    expect(response.status).toBe(201);
    expect(Date.parse(bodyOf(response).occurredAt)).toBeLessThan(Date.now());
  });

  it("accepts the 1900-01-01T00:00:00Z lower bound and round-trips it", async () => {
    const dealId = await createDealId();

    const response = await request(app)
      .post(`/deals/${dealId}/interactions`)
      .send({ type: "NOTE", notes: "x", occurredAt: "1900-01-01T00:00:00Z" });
    const fetched = await request(app).get(`/interactions/${bodyOf(response).id}`);

    expect(response.status).toBe(201);
    expect(bodyOf(fetched).occurredAt).toBe("1900-01-01T00:00:00.000Z");
  });

  it("truncates more than three fractional digits to milliseconds", async () => {
    const dealId = await createDealId();

    const response = await request(app)
      .post(`/deals/${dealId}/interactions`)
      .send({ type: "NOTE", notes: "x", occurredAt: "2026-01-15T10:30:00.123456Z" });

    expect(response.status).toBe(201);
    expect(bodyOf(response).occurredAt).toBe("2026-01-15T10:30:00.123Z");
  });

  it("allows interactions on WON and LOST deals", async () => {
    const companyId = await createCompany();
    const won = await seedDeal(companyId, { stage: "WON", closedAt: new Date() });
    const lost = await seedDeal(companyId, { stage: "LOST", closedAt: new Date() });

    const a = await request(app).post(`/deals/${won}/interactions`).send({ type: "NOTE", notes: "x" });
    const b = await request(app).post(`/deals/${lost}/interactions`).send({ type: "NOTE", notes: "x" });

    expect([a.status, b.status]).toEqual([201, 201]);
  });

  it.each(["EMAIL", "CALL", "MEETING", "NOTE"])("accepts type %s", async (type) => {
    const dealId = await createDealId();

    const response = await request(app).post(`/deals/${dealId}/interactions`).send({ type, notes: "x" });

    expect(response.status).toBe(201);
    expect(bodyOf(response).type).toBe(type);
  });

  it("orders by occurredAt, not createdAt", async () => {
    const dealId = await createDealId();
    const oldOccurredNewCreated = await prisma.interaction.create({
      data: { dealId, type: "NOTE", notes: "a", occurredAt: new Date("2025-01-01T00:00:00Z"), createdAt: new Date("2026-06-01T00:00:00Z") },
    });
    const newOccurredOldCreated = await prisma.interaction.create({
      data: { dealId, type: "NOTE", notes: "b", occurredAt: new Date("2025-06-01T00:00:00Z"), createdAt: new Date("2026-01-01T00:00:00Z") },
    });

    const response = await request(app).get(`/deals/${dealId}/interactions`);

    expect(bodyOf(response).data.map((i) => i.id)).toEqual([newOccurredOldCreated.id, oldOccurredNewCreated.id]);
  });

  it("returns exactly the documented interaction keys", async () => {
    const dealId = await createDealId();

    const response = await request(app).post(`/deals/${dealId}/interactions`).send({ type: "NOTE", notes: "x" });

    expect(Object.keys(response.body as object).sort()).toEqual(
      ["createdAt", "dealId", "id", "notes", "occurredAt", "type", "updatedAt"].sort(),
    );
  });

  it("keeps notes of exactly 5000 characters on PATCH and rejects 5001", async () => {
    const dealId = await createDealId();
    const created = await request(app).post(`/deals/${dealId}/interactions`).send({ type: "NOTE", notes: "x" });
    const id = bodyOf(created).id;

    const ok = await request(app).patch(`/interactions/${id}`).send({ notes: "a".repeat(5000) });
    const bad = await request(app).patch(`/interactions/${id}`).send({ notes: "a".repeat(5001) });

    expect(ok.status).toBe(200);
    expect(bad.status).toBe(400);
    expect((await prisma.interaction.findUniqueOrThrow({ where: { id } })).notes).toHaveLength(5000);
  });

  it("trims notes on PATCH", async () => {
    const dealId = await createDealId();
    const created = await request(app).post(`/deals/${dealId}/interactions`).send({ type: "NOTE", notes: "x" });

    const response = await request(app).patch(`/interactions/${bodyOf(created).id}`).send({ notes: "  trimmed  " });

    expect(bodyOf(response).notes).toBe("trimmed");
  });

  it("keeps the dealId when PATCH is sent a dealId (400) and when only notes change", async () => {
    const dealId = await createDealId();
    const other = await createDealId();
    const created = await request(app).post(`/deals/${dealId}/interactions`).send({ type: "NOTE", notes: "x" });

    const bad = await request(app).patch(`/interactions/${bodyOf(created).id}`).send({ dealId: other });
    const ok = await request(app).patch(`/interactions/${bodyOf(created).id}`).send({ notes: "y" });

    expect(bad.status).toBe(400);
    expect(bodyOf(ok).dealId).toBe(dealId);
  });

  it("validates the dealId param before the body on POST", async () => {
    const response = await request(app).post("/deals/not-a-uuid/interactions").send({ bad: true });

    const details = bodyOf(response).error.details as { path: unknown[] }[];
    expect(details[0]?.path[0]).toBe("dealId");
  });

  it("returns 404 with the deal id message for list on a missing deal", async () => {
    const missing = randomUUID();

    const response = await request(app).get(`/deals/${missing}/interactions`);

    expect(response.status).toBe(404);
    expect(bodyOf(response).error).toMatchObject({ code: "NOT_FOUND", message: `Deal ${missing} not found` });
  });

  it("returns 404 with the interaction id message for PATCH and DELETE on a missing interaction", async () => {
    const missing = randomUUID();

    const patch = await request(app).patch(`/interactions/${missing}`).send({ notes: "x" });
    const del = await request(app).delete(`/interactions/${missing}`);

    expect(bodyOf(patch).error.message).toBe(`Interaction ${missing} not found`);
    expect(bodyOf(del).error.message).toBe(`Interaction ${missing} not found`);
  });

  it("does not leak interactions of other deals through the list or total", async () => {
    const companyId = await createCompany();
    const a = await seedDeal(companyId);
    const b = await seedDeal(companyId);
    await prisma.interaction.createMany({
      data: [
        { dealId: a, type: "NOTE", notes: "1" },
        { dealId: a, type: "NOTE", notes: "2" },
        { dealId: b, type: "NOTE", notes: "3" },
      ],
    });

    const response = await request(app).get(`/deals/${a}/interactions?pageSize=1`);

    expect(bodyOf(response).meta.total).toBe(2);
    expect(bodyOf(response).data).toHaveLength(1);
  });
});
