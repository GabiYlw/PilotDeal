import { SEED } from "./state";

// A static export has one HTML file per page, built ahead of time, so a page for a client or deal
// created in the browser must already exist. These pools are those pages: the Nth client a visitor
// creates gets NEW_COMPANY_IDS[N], and its page is /clients/new-client-N. When a pool runs out the
// demo says so; a reload starts over.
// Contacts and interactions have no pages of their own, so their ids are not limited.

const POOL_SIZE = { companies: 10, deals: 20 };

function pool(prefix: string, size: number): readonly string[] {
  return Array.from({ length: size }, (_, index) => `${prefix}-${index + 1}`);
}

export const NEW_COMPANY_IDS = pool("new-client", POOL_SIZE.companies);
export const NEW_DEAL_IDS = pool("new-deal", POOL_SIZE.deals);

export const SEED_COMPANY_IDS: readonly string[] = SEED.companies.map((company) => company.id);
export const SEED_DEAL_IDS: readonly string[] = SEED.companies.flatMap((company) =>
  company.deals.map((deal) => deal.id),
);

// For generateStaticParams on the demo's /clients/[id] and /deals/[id] pages.
export function companyPageIds(): { id: string }[] {
  return [...SEED_COMPANY_IDS, ...NEW_COMPANY_IDS].map((id) => ({ id }));
}

export function dealPageIds(): { id: string }[] {
  return [...SEED_DEAL_IDS, ...NEW_DEAL_IDS].map((id) => ({ id }));
}
