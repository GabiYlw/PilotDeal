import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
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

async function createCompany(): Promise<string> {
  return (await prisma.company.create({ data: { name: "Acme" } })).id;
}

describe("migration (criterion 1, requirement 4)", () => {
  it("has exactly one add_companies_and_contacts folder sorted after enable_pgvector", () => {
    const dir = resolve(import.meta.dirname, "../../prisma/migrations");
    const matches = readdirSync(dir).filter((name) => name.endsWith("_add_companies_and_contacts"));
    expect(matches).toHaveLength(1);
    const folder = matches[0] ?? "";
    expect(folder > "20261028000000_enable_pgvector").toBe(true);
    const sql = readFileSync(resolve(dir, folder, "migration.sql"), "utf8");
    expect(sql).toContain("ON DELETE CASCADE");
  });

  it("created the Company and Contact tables in the test database", async () => {
    const rows = await prisma.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'`;
    const names = rows.map((row) => row.tablename);
    expect(names).toContain("Company");
    expect(names).toContain("Contact");
  });
});

describe("pagination query validation (criteria 9, 10)", () => {
  it.each(["pageSize=0", "pageSize=101", "pageSize=abc", "pageSize=", "pageSize=-5", "pageSize=1.5", "pageSize=10&pageSize=20"])(
    "returns 400 VALIDATION_ERROR for GET /companies?%s",
    async (query) => {
      const response = await request(app).get(`/companies?${query}`);
      expect(response.status).toBe(400);
      expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
    },
  );

  it("accepts page=1000000 and pageSize=1", async () => {
    const response = await request(app).get("/companies?page=1000000&pageSize=1");
    expect(response.status).toBe(200);
    expect(bodyOf(response).meta).toEqual({ page: 1000000, pageSize: 1, total: 0 });
  });

  it("returns defaults page 1 and pageSize 20", async () => {
    const response = await request(app).get("/companies");
    expect(bodyOf(response).meta).toEqual({ page: 1, pageSize: 20, total: 0 });
  });
});

describe("UUID param validation (requirement 26, edge cases)", () => {
  it.each(["123e4567-e89b-12d3-a456-42661417400Z", "12345", "00000000-0000-0000-0000-00000000000"])(
    "returns 400 for malformed id %s on every id route",
    async (id) => {
      const responses = await Promise.all([
        request(app).get(`/companies/${id}`),
        request(app).patch(`/companies/${id}`).send({ name: "x" }),
        request(app).delete(`/companies/${id}`),
        request(app).get(`/companies/${id}/contacts`),
        request(app).post(`/companies/${id}/contacts`).send({ name: "x" }),
        request(app).get(`/contacts/${id}`),
        request(app).patch(`/contacts/${id}`).send({ name: "x" }),
        request(app).delete(`/contacts/${id}`),
      ]);
      for (const response of responses) {
        expect(response.status).toBe(400);
      }
    },
  );

  it("returns 404, not 500, for the nil UUID on contacts", async () => {
    const nil = "00000000-0000-0000-0000-000000000000";
    const response = await request(app).get(`/contacts/${nil}`);
    expect(response.status).toBe(404);
  });
});

describe("validation order (requirement 31)", () => {
  it("reports the params error before the body error", async () => {
    const response = await request(app).patch("/companies/not-a-uuid").send({});
    expect(response.status).toBe(400);
    expect(bodyOf(response).error.message).toBe("Invalid route parameters");
  });

  it("reports the query error before the company lookup", async () => {
    const response = await request(app).get(`/companies/${randomUUID()}/contacts?page=0`);
    expect(response.status).toBe(400);
  });

  it("reports body errors before the company lookup on contact create", async () => {
    const response = await request(app).post(`/companies/${randomUUID()}/contacts`).send({});
    expect(response.status).toBe(400);
  });
});

describe("error response shape (criterion 23)", () => {
  it("returns details as { path, message } entries and nothing but error", async () => {
    const response = await request(app).post("/companies").send({ name: "" });
    const body = bodyOf(response);
    expect(Object.keys(body)).toEqual(["error"]);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect((body.error.details as unknown[]).length).toBeGreaterThan(0);
    for (const detail of body.error.details as object[]) {
      expect(Object.keys(detail).sort()).toEqual(["message", "path"]);
    }
  });

  it("returns NOT_FOUND with the exact company message", async () => {
    const id = randomUUID();
    const response = await request(app).get(`/companies/${id}`);
    expect(response.status).toBe(404);
    expect(bodyOf(response).error).toEqual({ code: "NOT_FOUND", message: `Company ${id} not found` });
  });

  it("returns the company message for a missing company on the nested route", async () => {
    const id = randomUUID();
    const response = await request(app).get(`/companies/${id}/contacts`);
    expect(bodyOf(response).error.message).toBe(`Company ${id} not found`);
  });

  it("returns the contact message for a missing contact", async () => {
    const id = randomUUID();
    const response = await request(app).delete(`/contacts/${id}`);
    expect(bodyOf(response).error).toEqual({ code: "NOT_FOUND", message: `Contact ${id} not found` });
  });
});

describe("company body validation (requirements 18 to 25)", () => {
  it.each([
    ["whitespace-only industry", { name: "A", industry: "   " }],
    ["empty industry", { name: "A", industry: "" }],
    ["101 character industry", { name: "A", industry: "x".repeat(101) }],
    ["2049 character website", { name: "A", website: `https://a.example.com/${"x".repeat(2030)}` }],
    ["javascript website", { name: "A", website: "javascript:alert(1)" }],
    ["id key", { name: "A", id: randomUUID() }],
    ["updatedAt key", { name: "A", updatedAt: "2026-01-01T00:00:00.000Z" }],
    ["string body", "just a string"],
    ["number body", 42],
  ])("returns 400 on POST for %s", async (_label, body) => {
    const response = await request(app).post("/companies").set("Content-Type", "application/json").send(JSON.stringify(body));
    expect(response.status).toBe(400);
    expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts 100 character industry and trims it", async () => {
    const response = await request(app).post("/companies").send({ name: "A", industry: ` ${"x".repeat(100)} ` });
    expect(response.status).toBe(201);
    expect(bodyOf(response).industry).toBe("x".repeat(100));
  });

  it.each([{ name: null }, { name: "   " }, { industry: "  " }, { id: randomUUID() }, { updatedAt: "2026-01-01T00:00:00.000Z" }, { foo: 1 }, { website: "ftp://x.com" }])(
    "returns 400 on PATCH for %j",
    async (body) => {
      const id = await createCompany();
      const response = await request(app).patch(`/companies/${id}`).send(body);
      expect(response.status).toBe(400);
      expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
    },
  );

  it.each([[[1, 2]], ["str"], [5]])("returns 400 on PATCH for non-object body %j", async (body) => {
    const id = await createCompany();
    const response = await request(app).patch(`/companies/${id}`).set("Content-Type", "application/json").send(JSON.stringify(body));
    expect(response.status).toBe(400);
  });

  it("returns 400 for PATCH with {} and keeps the company unchanged", async () => {
    const id = await createCompany();
    const response = await request(app).patch(`/companies/${id}`).send({});
    expect(response.status).toBe(400);
    expect((await prisma.company.findUniqueOrThrow({ where: { id } })).name).toBe("Acme");
  });

  it("stores null when POST sends explicit null optionals", async () => {
    const response = await request(app).post("/companies").send({ name: "A", industry: null, website: null });
    expect(response.status).toBe(201);
    expect(bodyOf(response)).toMatchObject({ industry: null, website: null });
    expect(bodyOf(response)).not.toHaveProperty("contacts");
  });

  it("does not create a company when validation fails", async () => {
    await request(app).post("/companies").send({ name: "A", foo: 1 });
    expect(await prisma.company.count()).toBe(0);
  });
});

describe("contact body validation (requirements 18 to 23)", () => {
  it.each([
    ["201 character name", { name: "x".repeat(201) }],
    ["null name", { name: null }],
    ["whitespace name", { name: "  " }],
    ["whitespace phone", { name: "J", phone: "  " }],
    ["51 character phone", { name: "J", phone: "1".repeat(51) }],
    ["101 character role", { name: "J", role: "r".repeat(101) }],
    ["whitespace role", { name: "J", role: " " }],
    ["321 character email", { name: "J", email: `${"a".repeat(314)}@ex.com` }],
    ["email with surrounding whitespace", { name: "J", email: " a@b.com " }],
    ["id key", { name: "J", id: randomUUID() }],
    ["createdAt key", { name: "J", createdAt: "2026-01-01T00:00:00.000Z" }],
  ])("returns 400 on POST for %s and creates nothing", async (_label, body) => {
    const companyId = await createCompany();
    const response = await request(app).post(`/companies/${companyId}/contacts`).send(body);
    expect(response.status).toBe(400);
    expect(bodyOf(response).error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.contact.count()).toBe(0);
  });

  it("stores null for omitted and null optional fields", async () => {
    const companyId = await createCompany();
    const response = await request(app).post(`/companies/${companyId}/contacts`).send({ name: "J", phone: null });
    expect(response.status).toBe(201);
    expect(bodyOf(response)).toMatchObject({ email: null, phone: null, role: null, companyId });
  });

  it("accepts 200 character name", async () => {
    const companyId = await createCompany();
    const response = await request(app).post(`/companies/${companyId}/contacts`).send({ name: "n".repeat(200) });
    expect(response.status).toBe(201);
  });

  it.each([{ id: randomUUID() }, { createdAt: "2026-01-01T00:00:00.000Z" }, { foo: 1 }, { name: null }, { phone: "" }])(
    "returns 400 on contact PATCH for %j",
    async (body) => {
      const companyId = await createCompany();
      const contact = await prisma.contact.create({ data: { companyId, name: "J" } });
      const response = await request(app).patch(`/contacts/${contact.id}`).send(body);
      expect(response.status).toBe(400);
    },
  );

  it("returns 400 for contact PATCH with no body", async () => {
    const companyId = await createCompany();
    const contact = await prisma.contact.create({ data: { companyId, name: "J" } });
    const response = await request(app).patch(`/contacts/${contact.id}`);
    expect(response.status).toBe(400);
  });

  it("returns 400 for a JSON array body on contact POST", async () => {
    const companyId = await createCompany();
    const response = await request(app)
      .post(`/companies/${companyId}/contacts`)
      .set("Content-Type", "application/json")
      .send("[]");
    expect(response.status).toBe(400);
  });

  it("returns 400 for malformed JSON on contact PATCH", async () => {
    const companyId = await createCompany();
    const contact = await prisma.contact.create({ data: { companyId, name: "J" } });
    const response = await request(app)
      .patch(`/contacts/${contact.id}`)
      .set("Content-Type", "application/json")
      .send("{bad");
    expect(response.status).toBe(400);
  });

  it("returns 404 for a valid PATCH body on a missing contact and does not upsert", async () => {
    const response = await request(app).patch(`/contacts/${randomUUID()}`).send({ role: "CTO" });
    expect(response.status).toBe(404);
    expect(await prisma.contact.count()).toBe(0);
  });
});

describe("contact list pagination (requirements 35 to 37)", () => {
  it("breaks createdAt ties by id descending and returns an empty page past the end", async () => {
    const companyId = await createCompany();
    const createdAt = new Date(Date.UTC(2026, 0, 1));
    const rows = await Promise.all([1, 2, 3].map((n) => prisma.contact.create({ data: { companyId, name: `C${n}`, createdAt } })));
    const expected = rows.map((row) => row.id).sort().reverse();
    const response = await request(app).get(`/companies/${companyId}/contacts`);
    expect((bodyOf(response).data as unknown as { id: string }[]).map((row) => row.id)).toEqual(expected);

    const past = await request(app).get(`/companies/${companyId}/contacts?page=50`);
    expect(past.status).toBe(200);
    expect(bodyOf(past)).toMatchObject({ data: [], meta: { page: 50, pageSize: 20, total: 3 } });
  });

  it.each(["pageSize=0", "pageSize=101", "page=1&page=2", "page="])("returns 400 for contacts list ?%s", async (query) => {
    const companyId = await createCompany();
    const response = await request(app).get(`/companies/${companyId}/contacts?${query}`);
    expect(response.status).toBe(400);
  });

  it("ignores unknown query parameters", async () => {
    const companyId = await createCompany();
    const response = await request(app).get(`/companies/${companyId}/contacts?foo=bar`);
    expect(response.status).toBe(200);
  });
});

describe("cascade (criterion 16, requirement 3)", () => {
  it("keeps contacts of other companies when one company is deleted", async () => {
    const first = await createCompany();
    const second = await createCompany();
    await prisma.contact.createMany({
      data: [
        { companyId: first, name: "A" },
        { companyId: first, name: "B" },
        { companyId: second, name: "C" },
      ],
    });
    const response = await request(app).delete(`/companies/${first}`);
    expect(response.status).toBe(204);
    expect(response.text).toBe("");
    expect(await prisma.contact.count({ where: { companyId: first } })).toBe(0);
    expect(await prisma.contact.count({ where: { companyId: second } })).toBe(1);
  });
});
