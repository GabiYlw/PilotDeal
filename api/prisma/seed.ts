import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "../generated/prisma/client.js";
import { loadConfig } from "../src/config/env.js";
import { runEmbeddingBackfill } from "../src/scripts/run-embedding-backfill.js";
import { companies, type SeedDeal } from "./seed-data.js";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

// UTC midnight of today plus the offset, matching how DATE columns are written by the API.
function dateInDays(days: number): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
}

function toDealCreate(deal: SeedDeal): Prisma.DealCreateWithoutCompanyInput {
  return {
    title: deal.title,
    value: deal.value,
    stage: deal.stage,
    expectedCloseDate:
      deal.expectedCloseInDays === null ? null : dateInDays(deal.expectedCloseInDays),
    createdAt: daysAgo(deal.createdDaysAgo),
    // Written directly because the seed bypasses DealService; kept consistent with its rule.
    closedAt: deal.closedDaysAgo === null ? null : daysAgo(deal.closedDaysAgo),
    interactions: {
      create: deal.interactions.map((interaction) => ({
        type: interaction.type,
        notes: interaction.notes,
        occurredAt: daysAgo(interaction.daysAgo),
      })),
    },
  };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: config.databaseUrl }),
  });

  try {
    // Idempotent: the cascade removes contacts, deals and interactions of the deleted companies.
    await prisma.company.deleteMany();

    for (const { contacts, deals, ...company } of companies) {
      await prisma.company.create({
        data: {
          ...company,
          contacts: { create: contacts },
          deals: { create: deals.map(toDealCreate) },
        },
      });
    }

    const [companyCount, contactCount, dealCount, interactionCount] = await Promise.all([
      prisma.company.count(),
      prisma.contact.count(),
      prisma.deal.count(),
      prisma.interaction.count(),
    ]);
    console.log(
      `Seeded ${companyCount} companies, ${contactCount} contacts, ${dealCount} deals and ${interactionCount} interactions.`,
    );
    // Makes the seeded notes searchable. Uses the real local model (downloaded on the first run).
    await runEmbeddingBackfill(config);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Seeding failed:", error);
  process.exitCode = 1;
});
