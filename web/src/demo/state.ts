import seedJson from "./data/seed.json";
import type { Company, Contact, Deal, DealStage, Interaction, InteractionType } from "@/lib/types";

// The static demo's data: the API's seed (exported by `npm --prefix api run demo:seed`), turned
// into the API's response shapes when the page loads. The seed's dates are relative ("6 days ago",
// "closes in 7 days"), so they are resolved against the visitor's clock: the sample data never
// goes stale. Everything lives in memory; a reload starts over from the seed.

interface SeedInteraction {
  id: string;
  type: InteractionType;
  notes: string;
  daysAgo: number;
}

interface SeedDeal {
  id: string;
  title: string;
  value: number;
  stage: DealStage;
  expectedCloseInDays: number | null;
  createdDaysAgo: number;
  closedDaysAgo: number | null;
  interactions: SeedInteraction[];
}

interface SeedCompany {
  id: string;
  name: string;
  industry: string;
  website: string;
  contacts: { id: string; name: string; email: string; phone: string; role: string }[];
  deals: SeedDeal[];
}

export const SEED = seedJson as { companies: SeedCompany[] };

export interface DemoState {
  /** The moment the demo loaded: "today" for the seed's relative dates. */
  loadedAt: Date;
  companies: Company[];
  contacts: Contact[];
  deals: Deal[];
  interactions: Interaction[];
  /** Ids deleted in this visit, so their pages can say so instead of "not found". */
  deletedIds: ReadonlySet<string>;
  /** How many items of each kind were created in this visit; new ids are numbered from it. */
  created: { companies: number; contacts: number; deals: number; interactions: number };
}

const DAY_MS = 86_400_000;

export function daysAgo(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

// YYYY-MM-DD of the UTC day `days` from now, like the API's DATE columns.
export function dateInDays(now: Date, days: number): string {
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days));
  return day.toISOString().slice(0, 10);
}

function toDeal(company: SeedCompany, deal: SeedDeal, now: Date): Deal {
  const createdAt = daysAgo(now, deal.createdDaysAgo);
  return {
    id: deal.id,
    companyId: company.id,
    title: deal.title,
    value: deal.value,
    stage: deal.stage,
    expectedCloseDate:
      deal.expectedCloseInDays === null ? null : dateInDays(now, deal.expectedCloseInDays),
    closedAt: deal.closedDaysAgo === null ? null : daysAgo(now, deal.closedDaysAgo),
    createdAt,
    updatedAt: createdAt,
  };
}

// The seed creates the clients one after another, so the last one is the newest. A second apart
// keeps that order for "newest first".
function companyCreatedAt(now: Date, index: number, count: number): string {
  return new Date(now.getTime() - (count - index) * 1000).toISOString();
}

export function initialState(now: Date): DemoState {
  const { companies } = SEED;
  return {
    loadedAt: now,
    companies: companies.map((company, index) => {
      const createdAt = companyCreatedAt(now, index, companies.length);
      return {
        id: company.id,
        name: company.name,
        industry: company.industry,
        website: company.website,
        createdAt,
        updatedAt: createdAt,
      };
    }),
    contacts: companies.flatMap((company, index) => {
      const createdAt = companyCreatedAt(now, index, companies.length);
      return company.contacts.map((contact) => ({
        ...contact,
        companyId: company.id,
        createdAt,
        updatedAt: createdAt,
      }));
    }),
    deals: companies.flatMap((company) => company.deals.map((deal) => toDeal(company, deal, now))),
    interactions: companies.flatMap((company) =>
      company.deals.flatMap((deal) =>
        deal.interactions.map((interaction) => {
          const occurredAt = daysAgo(now, interaction.daysAgo);
          return {
            id: interaction.id,
            dealId: deal.id,
            type: interaction.type,
            notes: interaction.notes,
            occurredAt,
            createdAt: occurredAt,
            updatedAt: occurredAt,
          };
        }),
      ),
    ),
    deletedIds: new Set(),
    created: { companies: 0, contacts: 0, deals: 0, interactions: 0 },
  };
}
