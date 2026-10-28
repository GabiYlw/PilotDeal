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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

beforeEach(async () => {
  await resetDatabase(prisma);
});

afterAll(async () => {
  await Promise.all([container.disconnect(), prisma.$disconnect()]);
});

async function seedCompanies(): Promise<string[]> {
  const names = ["Oldest", "Middle", "Newest"];
  const ids: string[] = [];
  for (const [index, name] of names.entries()) {
    const company = await prisma.company.create({
      data: { name, createdAt: new Date(Date.UTC(2026, 0, index + 1)) },
    });
    ids.push(company.id);
  }
  return ids;
}

describe("POST /companies", () => {
  it("creates a company with only a name", async () => {
    const response = await request(app).post("/companies").send({ name: "Acme" });

    expect(response.status).toBe(201);
    expect(bodyOf(response)).toMatchObject({ name: "Acme", industry: null, website: null });
    expect(bodyOf(response).id).toMatch(UUID_PATTERN);
    expect(new Date(bodyOf(response).createdAt).toISOString()).toBe(bodyOf(response).createdAt);
    expect(new Date(bodyOf(response).updatedAt).toISOString()).toBe(bodyOf(response).updatedAt);
    expect(bodyOf(response)).not.toHaveProperty("contacts");
  });

  it("creates a company with all fields", async () => {
    const body = { name: "Acme", industry: "Retail", website: "https://acme.example.com" };

    const response = await request(app).post("/companies").send(body);

    expect(response.status).toBe(201);
    expect(bodyOf(response)).toMatchObject(body);
  });

  it("stores null when optional fields are null", async () => {
    const response = await request(app)
      .post("/companies")
      .send({ name: "Acme", industry: null, website: null });

    expect(response.status).toBe(201);
    expect(bodyOf(response)).toMatchObject({ industry: null, website: null });
  });

  it("trims the name", async () => {
    const response = await request(app).post("/companies").send({ name: "  Acme  " });

    expect(response.status).toBe(201);
    expect(bodyOf(response).name).toBe("Acme");
  });

  it("accepts a 200 character name", async () => {
    const response = await request(app)
      .post("/companies")
      .send({ name: "a".repeat(200) });

    expect(response.status).toBe(201);
  });

  const invalidBodies: [string, unknown][] = [
    ["an empty object", {}],
    ["an empty name", { name: "" }],
    ["a whitespace-only name", { name: "   " }],
    ["a 201 character name", { name: "a".repeat(201) }],
    ["a malformed website", { name: "A", website: "not-a-url" }],
    ["a non-http website", { name: "A", website: "ftp://x.com" }],
    ["an unknown key", { name: "A", foo: 1 }],
    ["a null name", { name: null }],
    ["a whitespace-only industry", { name: "A", industry: "  " }],
    ["a protected field", { name: "A", id: randomUUID() }],
    ["a JSON array body", []],
  ];

  it.each(invalidBodies)("returns 400 for %s", async (_label, body) => {
    const response = await request(app).post("/companies").send(body as object);

    expect(response.status).toBe(400);
    expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(bodyOf(response).error.details)).toBe(true);
  });

  it("returns 400 when there is no body", async () => {
    const response = await request(app).post("/companies");

    expect(response.status).toBe(400);
    expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for malformed JSON", async () => {
    const response = await request(app)
      .post("/companies")
      .set("Content-Type", "application/json")
      .send("{not json");

    expect(response.status).toBe(400);
  });
});

describe("GET /companies", () => {
  it("returns an empty page when there are no companies", async () => {
    const response = await request(app).get("/companies");

    expect(response.status).toBe(200);
    expect(bodyOf(response)).toEqual({ data: [], meta: { page: 1, pageSize: 20, total: 0 } });
  });

  it("returns companies newest first", async () => {
    await seedCompanies();

    const response = await request(app).get("/companies");

    expect(bodyOf(response).data.map((company: { name: string }) => company.name)).toEqual([
      "Newest",
      "Middle",
      "Oldest",
    ]);
    expect(bodyOf(response).meta.total).toBe(3);
  });

  it("returns the requested page with the full total", async () => {
    await seedCompanies();

    const response = await request(app).get("/companies?page=2&pageSize=2");

    expect(response.status).toBe(200);
    expect(bodyOf(response).data.map((company: { name: string }) => company.name)).toEqual(["Oldest"]);
    expect(bodyOf(response).meta).toEqual({ page: 2, pageSize: 2, total: 3 });
  });

  it("breaks createdAt ties by id descending", async () => {
    const createdAt = new Date(Date.UTC(2026, 0, 1));
    await prisma.company.createMany({
      data: [
        { id: "00000000-0000-4000-8000-000000000001", name: "A", createdAt },
        { id: "00000000-0000-4000-8000-000000000002", name: "B", createdAt },
      ],
    });

    const response = await request(app).get("/companies");

    expect(bodyOf(response).data.map((company: { name: string }) => company.name)).toEqual(["B", "A"]);
  });

  it("returns an empty data array for a page past the end", async () => {
    await seedCompanies();

    const response = await request(app).get("/companies?page=99");

    expect(response.status).toBe(200);
    expect(bodyOf(response).data).toEqual([]);
    expect(bodyOf(response).meta.total).toBe(3);
  });

  it("accepts the maximum page size", async () => {
    const response = await request(app).get("/companies?pageSize=100");

    expect(response.status).toBe(200);
  });

  it("ignores unknown query parameters", async () => {
    const response = await request(app).get("/companies?sort=name");

    expect(response.status).toBe(200);
  });

  it.each([
    "page=0",
    "page=-1",
    "page=abc",
    "page=1.5",
    "page=",
    "page=1&page=2",
    "page=1000001",
    "pageSize=0",
    "pageSize=101",
    "pageSize=abc",
  ])("returns 400 for ?%s", async (query) => {
    const response = await request(app).get(`/companies?${query}`);

    expect(response.status).toBe(400);
    expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("GET /companies/:id", () => {
  it("returns the company", async () => {
    const [id] = await seedCompanies();

    const response = await request(app).get(`/companies/${id}`);

    expect(response.status).toBe(200);
    expect(bodyOf(response)).toMatchObject({ id, name: "Oldest" });
  });

  it("returns 404 when the company does not exist", async () => {
    const id = randomUUID();

    const response = await request(app).get(`/companies/${id}`);

    expect(response.status).toBe(404);
    expect(bodyOf(response)).toEqual({
      error: { code: "NOT_FOUND", message: `Company ${id} not found` },
    });
  });

  it("returns 404 for the nil UUID", async () => {
    const response = await request(app).get("/companies/00000000-0000-0000-0000-000000000000");

    expect(response.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const response = await request(app).get("/companies/not-a-uuid");

    expect(response.status).toBe(400);
    expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
  });
});

describe("PATCH /companies/:id", () => {
  it("updates only the provided field", async () => {
    const created = await request(app).post("/companies").send({ name: "Acme" });

    const response = await request(app)
      .patch(`/companies/${bodyOf(created).id}`)
      .send({ industry: "Retail" });

    expect(response.status).toBe(200);
    expect(bodyOf(response).industry).toBe("Retail");
    expect(bodyOf(response).name).toBe("Acme");
    expect(new Date(bodyOf(response).updatedAt).getTime()).toBeGreaterThanOrEqual(
      new Date(bodyOf(created).updatedAt).getTime(),
    );
  });

  it("clears an optional field when it is set to null", async () => {
    const created = await request(app)
      .post("/companies")
      .send({ name: "Acme", website: "https://acme.example.com" });

    const response = await request(app)
      .patch(`/companies/${bodyOf(created).id}`)
      .send({ website: null });

    expect(response.status).toBe(200);
    expect(bodyOf(response).website).toBeNull();
  });

  it.each([
    ["an empty object", {}],
    ["an empty name", { name: "" }],
    ["a malformed website", { website: "bad" }],
    ["an unknown key", { unknown: 1 }],
    ["a protected field", { createdAt: "2026-01-01T00:00:00.000Z" }],
  ])("returns 400 for %s", async (_label, body) => {
    const [id] = await seedCompanies();

    const response = await request(app).patch(`/companies/${id}`).send(body);

    expect(response.status).toBe(400);
    expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when there is no body", async () => {
    const [id] = await seedCompanies();

    const response = await request(app).patch(`/companies/${id}`);

    expect(response.status).toBe(400);
  });

  it("returns 404 when the company does not exist", async () => {
    const response = await request(app).patch(`/companies/${randomUUID()}`).send({ name: "X" });

    expect(response.status).toBe(404);
    expect(bodyOf(response).error.code).toBe("NOT_FOUND");
  });

  it("returns 400 for an invalid id", async () => {
    const response = await request(app).patch("/companies/not-a-uuid").send({ name: "X" });

    expect(response.status).toBe(400);
  });
});

describe("DELETE /companies/:id", () => {
  it("deletes the company and returns 204 with an empty body", async () => {
    const [id] = await seedCompanies();

    const response = await request(app).delete(`/companies/${id}`);

    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect((await request(app).get(`/companies/${id}`)).status).toBe(404);
  });

  it("returns 404 when the company does not exist", async () => {
    const response = await request(app).delete(`/companies/${randomUUID()}`);

    expect(response.status).toBe(404);
  });

  it("returns 400 for an invalid id", async () => {
    const response = await request(app).delete("/companies/not-a-uuid");

    expect(response.status).toBe(400);
  });

  it("deletes the contacts of the company too", async () => {
    const company = await prisma.company.create({ data: { name: "Acme" } });
    const contacts = await Promise.all(
      ["Jane", "John"].map((name) =>
        prisma.contact.create({ data: { name, companyId: company.id } }),
      ),
    );

    const response = await request(app).delete(`/companies/${company.id}`);

    expect(response.status).toBe(204);
    for (const contact of contacts) {
      expect((await request(app).get(`/contacts/${contact.id}`)).status).toBe(404);
    }
    expect(await prisma.contact.count({ where: { companyId: company.id } })).toBe(0);
  });
});
