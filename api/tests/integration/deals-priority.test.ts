import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { createTestPrisma, resetDatabase } from "./database.js";
import { bodyOf } from "./http.js";
import { loadTestConfig } from "./test-env.js";

const DAY = 86_400_000;
const NOW = new Date("2026-03-15T12:00:00.000Z");

const config = loadTestConfig();
const container = createContainer(config, { clock: { now: () => NOW } });
const app = createApp(container.controllers);
const prisma = createTestPrisma(config.databaseUrl);

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await Promise.all([container.disconnect(), prisma.$disconnect()]);
});

type Stage = "LEAD" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION" | "WON" | "LOST";

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

function isoDaysFromToday(n: number): string {
  return new Date(Date.UTC(2026, 2, 15 + n)).toISOString().slice(0, 10);
}

function uuid(suffix: string): string {
  return `00000000-0000-4000-8000-${suffix.padStart(12, "0")}`;
}

async function createCompany(name = "Acme"): Promise<string> {
  return (await prisma.company.create({ data: { name } })).id;
}

interface DealFixture {
  id?: string;
  stage?: Stage;
  value?: number;
  closeInDays?: number | null;
  /** Days before NOW of each interaction, inserted in the given order. */
  interactionDaysAgo?: number[];
}

// createdAt is always NOW (0 days of silence): the database default would be later than the fixed clock.
async function createDeal(companyId: string, fixture: DealFixture = {}): Promise<string> {
  const closeInDays = fixture.closeInDays ?? null;
  const stage = fixture.stage ?? "LEAD";
  const deal = await prisma.deal.create({
    data: {
      ...(fixture.id ? { id: fixture.id } : {}),
      companyId,
      title: "Deal",
      value: fixture.value ?? 100,
      stage,
      expectedCloseDate:
        closeInDays === null ? null : new Date(`${isoDaysFromToday(closeInDays)}T00:00:00.000Z`),
      closedAt: stage === "WON" || stage === "LOST" ? daysAgo(1) : null,
      createdAt: NOW,
    },
  });
  for (const days of fixture.interactionDaysAgo ?? []) {
    await prisma.interaction.create({
      data: { dealId: deal.id, type: "NOTE", notes: "n", occurredAt: daysAgo(days) },
    });
  }
  return deal.id;
}

const ID = {
  A: uuid("a0"),
  B: uuid("b0"),
  E: uuid("e0"),
  C: uuid("c0"),
  D: uuid("d0"),
  J: uuid("f2"),
  K: uuid("01"),
  I: uuid("a9"),
  F: uuid("f1"),
};

// Open deals with hand-computed scores (contact + close date + stage + value):
//  A NEGOTIATION, 60000, close date 1 day ago, last contact 30 days ago: 30+25+25+20 = 100
//  B PROPOSAL, 25000, closes in 5 days, last contact 9 days ago:         20+20+20+15 = 75
//  E QUALIFIED, 100, closes in 9 days, no contact:                         0+10+10+5 = 25
//  C QUALIFIED, 100, closes in 10 days:                                    0+10+10+5 = 25
//  D QUALIFIED, 100, closes in 10 days (same score and date as C):         0+10+10+5 = 25
//  J LEAD, 100, closes in 10 days (id sorts after K):                       0+10+5+5 = 20
//  K LEAD, 20000, no close date (no date sorts after J despite the smaller id):          0+0+5+15 = 20
//  I LEAD, 5000, no close date (id sorts before F):                          0+0+5+10 = 15
//  F QUALIFIED, 100, no close date:                                          0+0+10+5 = 15
const EXPECTED_ORDER = [ID.A, ID.B, ID.E, ID.C, ID.D, ID.J, ID.K, ID.I, ID.F];
const EXPECTED_SCORES = [100, 75, 25, 25, 25, 20, 20, 15, 15];

async function seedScenario(): Promise<void> {
  const companyId = await createCompany("Acme");
  // Inserted in a shuffled order so the result cannot depend on insertion order.
  await createDeal(companyId, { id: ID.F, stage: "QUALIFIED" });
  await createDeal(companyId, { id: ID.K, stage: "LEAD", value: 20_000 });
  await createDeal(companyId, { id: ID.D, stage: "QUALIFIED", closeInDays: 10 });
  await createDeal(companyId, {
    id: ID.A,
    stage: "NEGOTIATION",
    value: 60_000,
    closeInDays: -1,
    interactionDaysAgo: [30],
  });
  await createDeal(companyId, { id: ID.I, stage: "LEAD", value: 5000 });
  await createDeal(companyId, { id: ID.C, stage: "QUALIFIED", closeInDays: 10 });
  await createDeal(companyId, { id: ID.J, stage: "LEAD", closeInDays: 10 });
  await createDeal(companyId, {
    id: ID.B,
    stage: "PROPOSAL",
    value: 25_000,
    closeInDays: 5,
    interactionDaysAgo: [9],
  });
  await createDeal(companyId, { id: ID.E, stage: "QUALIFIED", closeInDays: 9 });
  // Closed deals that would score very high if they were not excluded.
  await createDeal(companyId, {
    stage: "WON",
    value: 90_000,
    closeInDays: -5,
    interactionDaysAgo: [40],
  });
  await createDeal(companyId, {
    stage: "LOST",
    value: 90_000,
    closeInDays: -5,
    interactionDaysAgo: [40],
  });
}

describe("GET /deals/prioritized", () => {
  it("orders open deals by score desc, then close date asc with nulls last, then id asc", async () => {
    await seedScenario();

    const response = await request(app).get("/deals/prioritized?pageSize=100");

    expect(response.status).toBe(200);
    const body = bodyOf(response);
    expect(body.data.map((item) => item.deal.id)).toEqual(EXPECTED_ORDER);
    expect(body.data.map((item) => item.priority.score)).toEqual(EXPECTED_SCORES);
  });

  it("excludes WON and LOST deals from data and from total", async () => {
    await seedScenario();

    const body = bodyOf(await request(app).get("/deals/prioritized?pageSize=100"));

    expect(body.data.map((item) => item.deal.stage)).not.toContain("WON");
    expect(body.data.map((item) => item.deal.stage)).not.toContain("LOST");
    expect(body.meta).toEqual({ page: 1, pageSize: 100, total: 9 });
  });

  it("returns consecutive slices of the sorted list across pages", async () => {
    await seedScenario();

    const page1 = bodyOf(await request(app).get("/deals/prioritized?page=1&pageSize=2"));
    const page2 = bodyOf(await request(app).get("/deals/prioritized?page=2&pageSize=2"));
    const page5 = bodyOf(await request(app).get("/deals/prioritized?page=5&pageSize=2"));

    expect(page1.data.map((i) => i.deal.id)).toEqual(EXPECTED_ORDER.slice(0, 2));
    expect(page1.meta).toEqual({ page: 1, pageSize: 2, total: 9 });
    expect(page2.data.map((i) => i.deal.id)).toEqual(EXPECTED_ORDER.slice(2, 4));
    expect(page2.meta).toEqual({ page: 2, pageSize: 2, total: 9 });
    expect(page5.data.map((i) => i.deal.id)).toEqual(EXPECTED_ORDER.slice(8, 9));
  });

  it("returns an empty page with the correct total past the end", async () => {
    await seedScenario();

    const response = await request(app).get("/deals/prioritized?page=10&pageSize=5");

    expect(response.status).toBe(200);
    expect(bodyOf(response).data).toEqual([]);
    expect(bodyOf(response).meta).toEqual({ page: 10, pageSize: 5, total: 9 });
  });

  it("returns 400 VALIDATION_ERROR for an invalid pagination query", async () => {
    const response = await request(app).get("/deals/prioritized?pageSize=101");

    expect(response.status).toBe(400);
    expect(bodyOf(response).error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Invalid query parameters",
    });
    expect(Array.isArray(bodyOf(response).error.details)).toBe(true);
  });

  it("returns each item as { deal, priority } with the documented keys", async () => {
    const companyId = await createCompany("Globex");
    await createDeal(companyId, { id: ID.A, stage: "QUALIFIED", value: 1234.5 });

    const item = bodyOf(await request(app).get("/deals/prioritized")).data[0];

    expect(Object.keys(item?.deal ?? {}).sort()).toEqual(
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
        "companyName",
      ].sort(),
    );
    expect(item?.deal.companyName).toBe("Globex");
    expect(item?.deal.value).toBe(1234.5);
    expect(Object.keys(item?.priority ?? {}).sort()).toEqual(
      ["score", "reason", "nextAction", "factors", "scoredBy"].sort(),
    );
    expect(item?.priority.scoredBy).toBe("rules");
  });

  it("scores a deal with 6 interactions from its most recent one", async () => {
    const companyId = await createCompany();
    // The newest interaction is inserted first, so it is not simply the last row.
    const dealId = await createDeal(companyId, {
      stage: "LEAD",
      interactionDaysAgo: [1, 40, 39, 38, 37, 36],
    });

    const item = bodyOf(await request(app).get("/deals/prioritized")).data[0];

    expect(item?.deal.id).toBe(dealId);
    // Last contact 1 day ago => 0 contact points; LEAD 5 + value 5.
    expect(item?.priority.score).toBe(10);
    expect(item?.priority.factors.map((f) => f.name)).toEqual(["stage", "value"]);
  });

  it("returns 200 with an empty list on an empty database, not the :id route error", async () => {
    const response = await request(app).get("/deals/prioritized");

    expect(response.status).toBe(200);
    expect(bodyOf(response)).toMatchObject({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0 },
    });
  });
});

describe("GET /deals/:id/next-action", () => {
  it("returns the exact score, reason and next action for a known deal", async () => {
    const companyId = await createCompany("Acme");
    const dealId = await createDeal(companyId, {
      stage: "PROPOSAL",
      value: 25_000,
      closeInDays: 5,
      interactionDaysAgo: [9],
    });

    const response = await request(app).get(`/deals/${dealId}/next-action`);

    expect(response.status).toBe(200);
    expect(bodyOf(response)).toEqual({
      dealId,
      score: 75,
      reason: "No contact for 9 days and the expected close date is in 5 days.",
      nextAction: "Follow up on the proposal and address open questions.",
      factors: [
        { name: "daysSinceContact", points: 20 },
        { name: "closeDate", points: 20 },
        { name: "stage", points: 20 },
        { name: "value", points: 15 },
      ],
      scoredBy: "rules",
    });
  });

  it("uses the company name in the follow-up action for a stale deal", async () => {
    const companyId = await createCompany("Initech");
    const dealId = await createDeal(companyId, { stage: "LEAD", interactionDaysAgo: [20] });

    const body = bodyOf(await request(app).get(`/deals/${dealId}/next-action`));

    expect(body.nextAction).toBe("Follow up with Initech: no contact for 20 days.");
  });

  it("returns 404 NOT_FOUND for a deal that does not exist", async () => {
    const id = randomUUID();

    const response = await request(app).get(`/deals/${id}/next-action`);

    expect(response.status).toBe(404);
    expect(bodyOf(response).error).toEqual({ code: "NOT_FOUND", message: `Deal ${id} not found` });
  });

  it.each(["WON", "LOST"] as const)("returns 409 DEAL_CLOSED for a %s deal", async (stage) => {
    const companyId = await createCompany();
    const dealId = await createDeal(companyId, { stage });

    const response = await request(app).get(`/deals/${dealId}/next-action`);

    expect(response.status).toBe(409);
    expect(bodyOf(response).error).toEqual({
      code: "DEAL_CLOSED",
      message: `Deal ${dealId} is closed (${stage})`,
    });
  });

  it("returns 400 VALIDATION_ERROR for an id that is not a UUID", async () => {
    const response = await request(app).get("/deals/not-a-uuid/next-action");

    expect(response.status).toBe(400);
    expect(bodyOf(response).error).toMatchObject({
      code: "VALIDATION_ERROR",
      message: "Invalid route parameters",
    });
    expect(Array.isArray(bodyOf(response).error.details)).toBe(true);
  });
});
