import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { PrismaCompanyRepository } from "../../src/modules/companies/companies.repository.js";
import type { Company } from "../../src/modules/companies/companies.schemas.js";
import { ContactController } from "../../src/modules/contacts/contacts.controller.js";
import { PrismaContactRepository } from "../../src/modules/contacts/contacts.repository.js";
import { ContactService } from "../../src/modules/contacts/contacts.service.js";
import { bodyOf } from "./http.js";
import { createTestPrisma, resetDatabase } from "./database.js";
import { loadTestConfig } from "./test-env.js";

const config = loadTestConfig();
const container = createContainer(config);
const prisma = createTestPrisma(config.databaseUrl);

// Simulates the race: the company exists when the service checks for it,
// but is deleted before the contact insert runs.
class CompanyDeletedAfterLookupRepository extends PrismaCompanyRepository {
  override async findById(id: string): Promise<Company | null> {
    const company = await super.findById(id);
    await prisma.company.delete({ where: { id } });
    return company;
  }
}

function createRacingApp() {
  const contactService = new ContactService(
    new PrismaContactRepository(prisma),
    new CompanyDeletedAfterLookupRepository(prisma),
  );
  return createApp({
    ...container.controllers,
    contactController: new ContactController(contactService),
  });
}

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await Promise.all([container.disconnect(), prisma.$disconnect()]);
});

describe("PrismaContactRepository.create", () => {
  it("returns null when the company does not exist (P2003 from the database)", async () => {
    const repository = new PrismaContactRepository(prisma);

    await expect(repository.create(randomUUID(), { name: "Jane Doe" })).resolves.toBeNull();
    expect(await prisma.contact.count()).toBe(0);
  });
});

describe("POST /companies/:companyId/contacts when the company is deleted mid-request", () => {
  it("returns 404 instead of 500 and creates no contact", async () => {
    const { id: companyId } = await prisma.company.create({ data: { name: "Acme" } });

    const response = await request(createRacingApp())
      .post(`/companies/${companyId}/contacts`)
      .send({ name: "Jane Doe" });

    expect(response.status).toBe(404);
    expect(bodyOf(response)).toEqual({
      error: { code: "NOT_FOUND", message: `Company ${companyId} not found` },
    });
    expect(await prisma.contact.count()).toBe(0);
  });
});
