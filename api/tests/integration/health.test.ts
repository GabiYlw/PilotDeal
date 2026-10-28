import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { createContainer } from "../../src/container.js";
import { healthStatusSchema } from "../../src/modules/health/health.schemas.js";
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

describe("GET /health", () => {
  it("returns 200 with status ok and database up", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", database: "up" });
    expect(healthStatusSchema.safeParse(response.body).success).toBe(true);
  });

  it("has the pgvector extension enabled by the migration", async () => {
    const rows = await prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;

    expect(rows).toHaveLength(1);
  });
});
