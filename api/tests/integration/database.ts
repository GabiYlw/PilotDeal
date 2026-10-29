import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import { toVectorLiteral } from "../../src/shared/pgvector.js";

export function createTestPrisma(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
}

// Empties every application table so each test starts from a clean database.
// Table names come from the Postgres catalog, not from user input.
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) {
    return;
  }
  const tableList = tables.map(({ tablename }) => `"public"."${tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`);
}

// Prisma cannot deserialize the vector type, so it is read as text and parsed.
export async function readEmbedding(prisma: PrismaClient, id: string): Promise<number[] | null> {
  const rows = await prisma.$queryRaw<{ embedding: string | null }[]>`
    SELECT "embedding"::text AS "embedding" FROM "Interaction" WHERE "id" = ${id}::uuid
  `;
  const text = rows[0]?.embedding;
  return text ? (JSON.parse(text) as number[]) : null;
}

export async function writeEmbedding(
  prisma: PrismaClient,
  id: string,
  vector: number[],
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE "Interaction" SET "embedding" = ${toVectorLiteral(vector)}::vector WHERE "id" = ${id}::uuid
  `;
}
