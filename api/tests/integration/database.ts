import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

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
