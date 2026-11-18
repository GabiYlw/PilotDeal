// The API's own rule-based scorer, imported from api/src: the demo scores deals with exactly the
// rules the API uses, so a stage, value or date change updates the score, rank and reason live.
// It is a pure function with no Node or zod imports (see api/src/scoring/rule-based-scorer.ts).
import type { DealContext } from "../../../api/src/scoring/priority-scorer";
import { scoreByRules } from "../../../api/src/scoring/rule-based-scorer";
import type {
  Company,
  Contact,
  Deal,
  DealNextAction,
  DealStage,
  DealWithCompany,
  Interaction,
  PageQuery,
  Paginated,
  PrioritizedDeal,
} from "@/lib/types";
import type { DemoState } from "./state";

// Reads the demo state in the API's response shapes and orders, so the dashboard's components
// render it unchanged.

const OPEN_STAGES: readonly DealStage[] = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION"];
type OpenStage = "LEAD" | "QUALIFIED" | "PROPOSAL" | "NEGOTIATION";

export function isOpenStage(stage: DealStage): stage is OpenStage {
  return OPEN_STAGES.includes(stage);
}

// Plain string comparison is valid for ISO timestamps, YYYY-MM-DD dates and ids.
function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

// The API's list order: newest first, then id descending.
function newestFirst<T extends { id: string }>(key: (item: T) => string) {
  return (a: T, b: T) => compareStrings(key(b), key(a)) || compareStrings(b.id, a.id);
}

function paginate<T>(items: T[], { page, pageSize }: PageQuery): Paginated<T> {
  const start = (page - 1) * pageSize;
  return {
    data: items.slice(start, start + pageSize),
    meta: { page, pageSize, total: items.length },
  };
}

export function findCompany(state: DemoState, id: string): Company | undefined {
  return state.companies.find((company) => company.id === id);
}

export function findDeal(state: DemoState, id: string): Deal | undefined {
  return state.deals.find((deal) => deal.id === id);
}

export function listCompanies(state: DemoState, query: PageQuery): Paginated<Company> {
  return paginate([...state.companies].sort(newestFirst((company) => company.createdAt)), query);
}

export function companyContacts(state: DemoState, companyId: string): Contact[] {
  return state.contacts
    .filter((contact) => contact.companyId === companyId)
    .sort(newestFirst((contact) => contact.createdAt));
}

export function companyDeals(state: DemoState, companyId: string): Deal[] {
  return state.deals
    .filter((deal) => deal.companyId === companyId)
    .sort(newestFirst((deal) => deal.createdAt));
}

export function dealInteractions(state: DemoState, dealId: string): Interaction[] {
  return state.interactions
    .filter((interaction) => interaction.dealId === dealId)
    .sort(newestFirst((interaction) => interaction.occurredAt));
}

// What the API's scorer receives: the deal, its client's name and its five newest interactions.
function dealContext(state: DemoState, deal: Deal, stage: OpenStage): DealContext {
  const interactions = dealInteractions(state, deal.id);
  return {
    deal: {
      id: deal.id,
      title: deal.title,
      value: deal.value,
      stage,
      expectedCloseDate: deal.expectedCloseDate,
      createdAt: new Date(deal.createdAt),
    },
    companyName: findCompany(state, deal.companyId)?.name ?? "",
    interactionCount: interactions.length,
    recentInteractions: interactions.slice(0, 5).map((interaction) => ({
      type: interaction.type,
      notes: interaction.notes,
      occurredAt: new Date(interaction.occurredAt),
    })),
  };
}

// A missing close date sorts last.
function compareCloseDates(a: string | null, b: string | null): number {
  if (a === null || b === null) {
    return Number(a === null) - Number(b === null);
  }
  return compareStrings(a, b);
}

// The API's order (DealService): score descending, then close date (none last), then id.
function comparePrioritized(a: PrioritizedDeal, b: PrioritizedDeal): number {
  return (
    b.priority.score - a.priority.score ||
    compareCloseDates(a.deal.expectedCloseDate, b.deal.expectedCloseDate) ||
    compareStrings(a.deal.id, b.deal.id)
  );
}

function withCompany(state: DemoState, deal: Deal): DealWithCompany {
  return { ...deal, companyName: findCompany(state, deal.companyId)?.name ?? "" };
}

// Scored with the visitor's current time, like the API scores with the server's.
export function prioritizedDeals(
  state: DemoState,
  query: PageQuery,
  now: Date,
): Paginated<PrioritizedDeal> {
  const ranked = state.deals
    .flatMap((deal) =>
      isOpenStage(deal.stage)
        ? [
            {
              deal: withCompany(state, deal),
              priority: scoreByRules(dealContext(state, deal, deal.stage), now),
            },
          ]
        : [],
    )
    .sort(comparePrioritized);
  return paginate(ranked, query);
}

// null for a closed (WON or LOST) deal, which has no next action.
export function nextAction(state: DemoState, deal: Deal, now: Date): DealNextAction | null {
  if (!isOpenStage(deal.stage)) return null;
  return { dealId: deal.id, ...scoreByRules(dealContext(state, deal, deal.stage), now) };
}
