import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { bodyOf } from "./http.js";
import { createTestPrisma, resetDatabase } from "./database.js";
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
  const company = await prisma.company.create({ data: { name } });
  return company.id;
}

async function createContact(companyId: string, name = "Jane Doe", day = 1): Promise<string> {
  const contact = await prisma.contact.create({
    data: { companyId, name, createdAt: new Date(Date.UTC(2026, 0, day)) },
  });
  return contact.id;
}

describe("POST /companies/:companyId/contacts", () => {
  it("creates a contact for the company", async () => {
    const companyId = await createCompany();

    const response = await request(app)
      .post(`/companies/${companyId}/contacts`)
      .send({ name: "Jane Doe", email: "jane@acme.example.com" });

    expect(response.status).toBe(201);
    expect(bodyOf(response)).toMatchObject({
      companyId,
      name: "Jane Doe",
      email: "jane@acme.example.com",
      phone: null,
      role: null,
    });
    expect(typeof bodyOf(response).id).toBe("string");
  });

  it("trims name, phone and role", async () => {
    const companyId = await createCompany();

    const response = await request(app)
      .post(`/companies/${companyId}/contacts`)
      .send({ name: " Jane ", phone: " 123 ", role: " CTO " });

    expect(response.status).toBe(201);
    expect(bodyOf(response)).toMatchObject({ name: "Jane", phone: "123", role: "CTO" });
  });

  it.each([
    ["an empty object", {}],
    ["an empty name", { name: "" }],
    ["an invalid email", { name: "J", email: "not-an-email" }],
    ["a companyId in the body", { name: "J", companyId: randomUUID() }],
    ["an unknown key", { name: "J", extra: true }],
    ["a whitespace-only role", { name: "J", role: "   " }],
    ["a JSON array body", []],
  ])("returns 400 for %s", async (_label, body) => {
    const companyId = await createCompany();

    const response = await request(app).post(`/companies/${companyId}/contacts`).send(body);

    expect(response.status).toBe(400);
    expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.contact.count()).toBe(0);
  });

  it("returns 400 when there is no body", async () => {
    const companyId = await createCompany();

    const response = await request(app).post(`/companies/${companyId}/contacts`);

    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid company id", async () => {
    const response = await request(app).post("/companies/not-a-uuid/contacts").send({ name: "J" });

    expect(response.status).toBe(400);
  });

  it("returns 404 and creates nothing when the company does not exist", async () => {
    const companyId = randomUUID();

    const response = await request(app).post(`/companies/${companyId}/contacts`).send({ name: "J" });

    expect(response.status).toBe(404);
    expect(bodyOf(response)).toEqual({
      error: { code: "NOT_FOUND", message: `Company ${companyId} not found` },
    });
    expect(await prisma.contact.count()).toBe(0);
  });
});

describe("GET /companies/:companyId/contacts", () => {
  it("returns only the contacts of that company, newest first", async () => {
    const companyId = await createCompany();
    const otherCompanyId = await createCompany("Other");
    await createContact(companyId, "Old", 1);
    await createContact(companyId, "New", 2);
    await createContact(otherCompanyId, "Foreign", 3);

    const response = await request(app).get(`/companies/${companyId}/contacts`);

    expect(response.status).toBe(200);
    expect(bodyOf(response).data.map((contact: { name: string }) => contact.name)).toEqual([
      "New",
      "Old",
    ]);
    expect(bodyOf(response).meta).toEqual({ page: 1, pageSize: 20, total: 2 });
  });

  it("paginates and counts only that company's contacts", async () => {
    const companyId = await createCompany();
    const otherCompanyId = await createCompany("Other");
    await createContact(companyId, "A", 1);
    await createContact(companyId, "B", 2);
    await createContact(companyId, "C", 3);
    await createContact(otherCompanyId, "Foreign", 4);

    const response = await request(app).get(`/companies/${companyId}/contacts?page=2&pageSize=2`);

    expect(bodyOf(response).data.map((contact: { name: string }) => contact.name)).toEqual(["A"]);
    expect(bodyOf(response).meta).toEqual({ page: 2, pageSize: 2, total: 3 });
  });

  it("returns an empty list for a company without contacts", async () => {
    const companyId = await createCompany();

    const response = await request(app).get(`/companies/${companyId}/contacts`);

    expect(response.status).toBe(200);
    expect(bodyOf(response)).toEqual({ data: [], meta: { page: 1, pageSize: 20, total: 0 } });
  });

  it("returns 400 for invalid pagination", async () => {
    const companyId = await createCompany();

    const response = await request(app).get(`/companies/${companyId}/contacts?page=0`);

    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid company id", async () => {
    const response = await request(app).get("/companies/not-a-uuid/contacts");

    expect(response.status).toBe(400);
  });

  it("returns 404 when the company does not exist", async () => {
    const response = await request(app).get(`/companies/${randomUUID()}/contacts`);

    expect(response.status).toBe(404);
    expect(bodyOf(response).error.code).toBe("NOT_FOUND");
  });
});

describe("GET /contacts/:id", () => {
  it("returns the contact", async () => {
    const companyId = await createCompany();
    const id = await createContact(companyId);

    const response = await request(app).get(`/contacts/${id}`);

    expect(response.status).toBe(200);
    expect(bodyOf(response)).toMatchObject({ id, companyId, name: "Jane Doe" });
  });

  it("returns 404 when the contact does not exist", async () => {
    const id = randomUUID();

    const response = await request(app).get(`/contacts/${id}`);

    expect(response.status).toBe(404);
    expect(bodyOf(response).error.message).toBe(`Contact ${id} not found`);
  });

  it("returns 400 for an invalid id", async () => {
    const response = await request(app).get("/contacts/not-a-uuid");

    expect(response.status).toBe(400);
  });
});

describe("PATCH /contacts/:id", () => {
  it("updates only the provided field", async () => {
    const companyId = await createCompany();
    const id = await createContact(companyId);

    const response = await request(app).patch(`/contacts/${id}`).send({ role: "CTO" });

    expect(response.status).toBe(200);
    expect(bodyOf(response)).toMatchObject({ id, name: "Jane Doe", role: "CTO", companyId });
  });

  it("clears the email when it is set to null", async () => {
    const companyId = await createCompany();
    const created = await request(app)
      .post(`/companies/${companyId}/contacts`)
      .send({ name: "Jane", email: "jane@acme.example.com" });

    const response = await request(app)
      .patch(`/contacts/${bodyOf(created).id}`)
      .send({ email: null });

    expect(response.status).toBe(200);
    expect(bodyOf(response).email).toBeNull();
  });

  it.each([
    ["an empty object", {}],
    ["an invalid email", { email: "bad" }],
    ["an empty name", { name: "" }],
  ])("returns 400 for %s", async (_label, body) => {
    const id = await createContact(await createCompany());

    const response = await request(app).patch(`/contacts/${id}`).send(body);

    expect(response.status).toBe(400);
  });

  it("returns 400 and keeps the company when companyId is sent", async () => {
    const companyId = await createCompany();
    const otherCompanyId = await createCompany("Other");
    const id = await createContact(companyId);

    const response = await request(app).patch(`/contacts/${id}`).send({ companyId: otherCompanyId });

    expect(response.status).toBe(400);
    const stored = await prisma.contact.findUniqueOrThrow({ where: { id } });
    expect(stored.companyId).toBe(companyId);
  });

  it("returns 404 when the contact does not exist", async () => {
    const response = await request(app).patch(`/contacts/${randomUUID()}`).send({ role: "CTO" });

    expect(response.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const response = await request(app).patch("/contacts/not-a-uuid").send({ role: "CTO" });

    expect(response.status).toBe(400);
  });
});

describe("DELETE /contacts/:id", () => {
  it("deletes the contact and keeps the company", async () => {
    const companyId = await createCompany();
    const id = await createContact(companyId);

    const response = await request(app).delete(`/contacts/${id}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect((await request(app).get(`/contacts/${id}`)).status).toBe(404);
    expect((await request(app).get(`/companies/${companyId}`)).status).toBe(200);
  });

  it("returns 404 when the contact does not exist", async () => {
    const response = await request(app).delete(`/contacts/${randomUUID()}`);

    expect(response.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const response = await request(app).delete("/contacts/not-a-uuid");

    expect(response.status).toBe(400);
  });
});
