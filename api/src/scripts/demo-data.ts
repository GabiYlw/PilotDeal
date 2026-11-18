import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { companies, type SeedCompany, type SeedDeal } from "../../prisma/seed-data.js";

// Shared by the two scripts that write the static demo's data (web/src/demo/data/).
// The demo runs without the API or a database, so it needs stable, readable ids: they are derived
// from the seed's names and positions, so the same seed always gives the same ids.

export const DEMO_DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "web",
  "src",
  "demo",
  "data",
);

function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function companyId(company: SeedCompany): string {
  return slug(company.name);
}

function dealId(deal: SeedDeal): string {
  return slug(deal.title);
}

export function interactionId(deal: SeedDeal, index: number): string {
  return `${dealId(deal)}-note-${index + 1}`;
}

// The seed with ids added. Dates stay relative (days ago, days until close): the demo turns them
// into dates when the page loads, so "overdue" and "days since contact" are right on any day.
export function demoSeed() {
  return {
    companies: companies.map((company) => ({
      id: companyId(company),
      name: company.name,
      industry: company.industry,
      website: company.website,
      contacts: company.contacts.map((contact, index) => ({
        id: `${companyId(company)}-contact-${index + 1}`,
        ...contact,
      })),
      deals: company.deals.map((deal) => ({
        id: dealId(deal),
        title: deal.title,
        value: deal.value,
        stage: deal.stage,
        expectedCloseInDays: deal.expectedCloseInDays,
        createdDaysAgo: deal.createdDaysAgo,
        closedDaysAgo: deal.closedDaysAgo,
        interactions: deal.interactions.map((interaction, index) => ({
          id: interactionId(deal, index),
          ...interaction,
        })),
      })),
    })),
  };
}

// Every seeded interaction with its demo id and the names a source card shows.
export function demoInteractions() {
  return companies.flatMap((company) =>
    company.deals.flatMap((deal) =>
      deal.interactions.map((interaction, index) => ({
        id: interactionId(deal, index),
        dealTitle: deal.title,
        companyName: company.name,
        notes: interaction.notes,
      })),
    ),
  );
}

export function writeDemoJson(fileName: string, data: unknown): string {
  mkdirSync(DEMO_DATA_DIR, { recursive: true });
  const path = join(DEMO_DATA_DIR, fileName);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
  return path;
}
