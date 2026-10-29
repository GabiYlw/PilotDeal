import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { PrismaCompanyRepository } from "../../src/modules/companies/companies.repository.js";
import type { Company } from "../../src/modules/companies/companies.schemas.js";
import { DealController } from "../../src/modules/deals/deals.controller.js";
import { PrismaDealRepository } from "../../src/modules/deals/deals.repository.js";
import type { Deal } from "../../src/modules/deals/deals.schemas.js";
import { DealService } from "../../src/modules/deals/deals.service.js";
import { InteractionController } from "../../src/modules/interactions/interactions.controller.js";
import { PrismaInteractionRepository } from "../../src/modules/interactions/interactions.repository.js";
import { InteractionService } from "../../src/modules/interactions/interactions.service.js";
import type { PriorityResult, PriorityScorer } from "../../src/scoring/priority-scorer.js";
import { createTestPrisma, resetDatabase } from "./database.js";
import { bodyOf } from "./http.js";
import { loadTestConfig } from "./test-env.js";

const config = loadTestConfig();
const container = createContainer(config);
const prisma = createTestPrisma(config.databaseUrl);

// These races never reach scoring, so the stub fails loudly if one does.
const unusedScorer: PriorityScorer = {
  score: (): Promise<PriorityResult> => Promise.reject(new Error("scorer must not be called")),
};

// Each subclass reads the row, then deletes it, so the next step runs against a vanished parent.
class CompanyDeletedAfterLookupRepository extends PrismaCompanyRepository {
  override async findById(id: string): Promise<Company | null> {
    const company = await super.findById(id);
    await prisma.company.delete({ where: { id } });
    return company;
  }
}

class DealDeletedAfterLookupRepository extends PrismaDealRepository {
  override async findById(id: string): Promise<Deal | null> {
    const deal = await super.findById(id);
    await prisma.deal.delete({ where: { id } });
    return deal;
  }
}

function createDealRacingApp() {
  const dealService = new DealService(
    new PrismaDealRepository(prisma),
    new CompanyDeletedAfterLookupRepository(prisma),
    unusedScorer,
  );
  return createApp({ ...container.controllers, dealController: new DealController(dealService) });
}

function createStagePatchRacingApp() {
  const dealService = new DealService(
    new DealDeletedAfterLookupRepository(prisma),
    new PrismaCompanyRepository(prisma),
    unusedScorer,
  );
  return createApp({ ...container.controllers, dealController: new DealController(dealService) });
}

function createInteractionRacingApp() {
  const interactionService = new InteractionService(
    new PrismaInteractionRepository(prisma),
    new DealDeletedAfterLookupRepository(prisma),
  );
  return createApp({
    ...container.controllers,
    interactionController: new InteractionController(interactionService),
  });
}

async function createDeal(): Promise<string> {
  const company = await prisma.company.create({ data: { name: "Acme" } });
  return (await prisma.deal.create({ data: { companyId: company.id, title: "D", value: 1 } })).id;
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await Promise.all([container.disconnect(), prisma.$disconnect()]);
});

describe("foreign key races in the repositories", () => {
  it("PrismaDealRepository.create returns null when the company does not exist", async () => {
    const repository = new PrismaDealRepository(prisma);

    await expect(
      repository.create(randomUUID(), { title: "T", value: 1, stage: "LEAD", closedAt: null }),
    ).resolves.toBeNull();
    expect(await prisma.deal.count()).toBe(0);
  });

  it("PrismaInteractionRepository.create returns null when the deal does not exist", async () => {
    const repository = new PrismaInteractionRepository(prisma);

    await expect(repository.create(randomUUID(), { type: "NOTE", notes: "x" })).resolves.toBeNull();
    expect(await prisma.interaction.count()).toBe(0);
  });
});

describe("POST /companies/:companyId/deals when the company is deleted mid-request", () => {
  it("returns 404 instead of 500 and creates no deal", async () => {
    const { id: companyId } = await prisma.company.create({ data: { name: "Acme" } });

    const response = await request(createDealRacingApp())
      .post(`/companies/${companyId}/deals`)
      .send({ title: "T", value: 1 });

    expect(response.status).toBe(404);
    expect(bodyOf(response).error.message).toBe(`Company ${companyId} not found`);
    expect(await prisma.deal.count()).toBe(0);
  });
});

describe("POST /deals/:dealId/interactions when the deal is deleted mid-request", () => {
  it("returns 404 instead of 500 and creates no interaction", async () => {
    const dealId = await createDeal();

    const response = await request(createInteractionRacingApp())
      .post(`/deals/${dealId}/interactions`)
      .send({ type: "NOTE", notes: "x" });

    expect(response.status).toBe(404);
    expect(bodyOf(response).error.message).toBe(`Deal ${dealId} not found`);
    expect(await prisma.interaction.count()).toBe(0);
  });
});

describe("PATCH /deals/:id with stage when the deal is deleted between read and update", () => {
  it("returns 404 instead of 500", async () => {
    const dealId = await createDeal();

    const response = await request(createStagePatchRacingApp())
      .patch(`/deals/${dealId}`)
      .send({ stage: "WON" });

    expect(response.status).toBe(404);
    expect(bodyOf(response).error.message).toBe(`Deal ${dealId} not found`);
  });
});
