import type {
  Company,
  CompanyBody,
  Contact,
  ContactBody,
  CreateDealBody,
  CreateInteractionBody,
  Deal,
  DealStage,
  Interaction,
  UpdateDealBody,
  UpdateInteractionBody,
} from "@/lib/types";
import { NEW_COMPANY_IDS, NEW_DEAL_IDS } from "./ids";
import { findCompany, findDeal, isOpenStage } from "./queries";
import type { DemoState } from "./state";
import { Checker, DEMO_LIMIT, DemoApiError, notFound } from "./validation";

// The API's writes, applied to the in-memory demo state. Each takes the current state and returns
// the next one with the result, or throws a DemoApiError shaped like the API's error (400 with
// field issues, 404). Pure functions, so they are tested without React.

export interface Change<T> {
  state: DemoState;
  result: T;
}

function stamp(now: Date): string {
  return now.toISOString();
}

function deleted(state: DemoState, ...ids: string[]): ReadonlySet<string> {
  return new Set([...state.deletedIds, ...ids]);
}

function nextPoolId(pool: readonly string[], used: number, what: string): string {
  const id = pool[used];
  if (id === undefined) {
    throw new DemoApiError(
      `The demo holds up to ${pool.length} new ${what}. Reload the page to start over with the sample data.`,
      409,
      DEMO_LIMIT,
    );
  }
  return id;
}

function requireCompany(state: DemoState, id: string): Company {
  const company = findCompany(state, id);
  if (!company) throw notFound(`Company ${id}`);
  return company;
}

function requireDeal(state: DemoState, id: string): Deal {
  const deal = findDeal(state, id);
  if (!deal) throw notFound(`Deal ${id}`);
  return deal;
}

function checkCompany(body: CompanyBody) {
  const check = new Checker();
  const fields = {
    name: check.requiredText("name", "Name", 200, body.name),
    industry: check.optionalText("industry", "Industry", 100, body.industry),
    website: check.website(body.website),
  };
  check.throwIfInvalid();
  return { ...fields, name: fields.name ?? "" };
}

export function createCompany(state: DemoState, body: CompanyBody, now: Date): Change<Company> {
  const fields = checkCompany(body);
  const id = nextPoolId(NEW_COMPANY_IDS, state.created.companies, "clients");
  const company: Company = { id, ...fields, createdAt: stamp(now), updatedAt: stamp(now) };
  return {
    state: {
      ...state,
      companies: [...state.companies, company],
      created: { ...state.created, companies: state.created.companies + 1 },
    },
    result: company,
  };
}

export function updateCompany(
  state: DemoState,
  id: string,
  body: CompanyBody,
  now: Date,
): Change<Company> {
  const current = requireCompany(state, id);
  const company: Company = { ...current, ...checkCompany(body), updatedAt: stamp(now) };
  return {
    state: {
      ...state,
      companies: state.companies.map((item) => (item.id === id ? company : item)),
    },
    result: company,
  };
}

// Like the database's cascade: the client's contacts, deals and their interactions go too.
export function deleteCompany(state: DemoState, id: string): Change<void> {
  requireCompany(state, id);
  const dealIds = state.deals.filter((deal) => deal.companyId === id).map((deal) => deal.id);
  return {
    state: {
      ...state,
      companies: state.companies.filter((company) => company.id !== id),
      contacts: state.contacts.filter((contact) => contact.companyId !== id),
      deals: state.deals.filter((deal) => deal.companyId !== id),
      interactions: state.interactions.filter(
        (interaction) => !dealIds.includes(interaction.dealId),
      ),
      deletedIds: deleted(state, id, ...dealIds),
    },
    result: undefined,
  };
}

function checkContact(body: ContactBody) {
  const check = new Checker();
  const fields = {
    name: check.requiredText("name", "Name", 200, body.name),
    email: check.email(body.email),
    phone: check.optionalText("phone", "Phone", 50, body.phone),
    role: check.optionalText("role", "Role", 100, body.role),
  };
  check.throwIfInvalid();
  return { ...fields, name: fields.name ?? "" };
}

export function createContact(
  state: DemoState,
  companyId: string,
  body: ContactBody,
  now: Date,
): Change<Contact> {
  requireCompany(state, companyId);
  const fields = checkContact(body);
  const contact: Contact = {
    id: `new-contact-${state.created.contacts + 1}`,
    companyId,
    ...fields,
    createdAt: stamp(now),
    updatedAt: stamp(now),
  };
  return {
    state: {
      ...state,
      contacts: [...state.contacts, contact],
      created: { ...state.created, contacts: state.created.contacts + 1 },
    },
    result: contact,
  };
}

export function updateContact(
  state: DemoState,
  id: string,
  body: ContactBody,
  now: Date,
): Change<Contact> {
  const current = state.contacts.find((contact) => contact.id === id);
  if (!current) throw notFound(`Contact ${id}`);
  const contact: Contact = { ...current, ...checkContact(body), updatedAt: stamp(now) };
  return {
    state: { ...state, contacts: state.contacts.map((item) => (item.id === id ? contact : item)) },
    result: contact,
  };
}

export function deleteContact(state: DemoState, id: string): Change<void> {
  if (!state.contacts.some((contact) => contact.id === id)) throw notFound(`Contact ${id}`);
  return {
    state: { ...state, contacts: state.contacts.filter((contact) => contact.id !== id) },
    result: undefined,
  };
}

// closedAt follows the stage, like DealService: set when a deal is won or lost, cleared when it
// reopens, kept when the stage does not change.
function closedAtFor(stage: DealStage, current: Deal | null, now: Date): string | null {
  if (current !== null && current.stage === stage) return current.closedAt;
  return isOpenStage(stage) ? null : stamp(now);
}

export function createDeal(
  state: DemoState,
  companyId: string,
  body: CreateDealBody,
  now: Date,
): Change<Deal> {
  requireCompany(state, companyId);
  const check = new Checker();
  const title = check.requiredText("title", "Title", 200, body.title);
  const value = check.dealValue(body.value, true);
  const stage = check.stage(body.stage);
  const expectedCloseDate = check.closeDate(body.expectedCloseDate);
  check.throwIfInvalid();
  const id = nextPoolId(NEW_DEAL_IDS, state.created.deals, "deals");
  const dealStage = stage ?? "LEAD";
  const deal: Deal = {
    id,
    companyId,
    title: title ?? "",
    value: value ?? 0,
    stage: dealStage,
    expectedCloseDate: expectedCloseDate ?? null,
    closedAt: closedAtFor(dealStage, null, now),
    createdAt: stamp(now),
    updatedAt: stamp(now),
  };
  return {
    state: {
      ...state,
      deals: [...state.deals, deal],
      created: { ...state.created, deals: state.created.deals + 1 },
    },
    result: deal,
  };
}

// Only the fields present in the body change, like the API's PATCH.
export function updateDeal(
  state: DemoState,
  id: string,
  body: UpdateDealBody,
  now: Date,
): Change<Deal> {
  const current = requireDeal(state, id);
  const check = new Checker();
  const title =
    body.title === undefined ? undefined : check.requiredText("title", "Title", 200, body.title);
  const value = check.dealValue(body.value, false);
  const stage = body.stage === undefined ? undefined : check.stage(body.stage);
  const expectedCloseDate = check.closeDate(body.expectedCloseDate);
  check.throwIfInvalid();
  const nextStage = stage ?? current.stage;
  const deal: Deal = {
    ...current,
    ...(title !== undefined && { title }),
    ...(value !== undefined && { value }),
    ...(expectedCloseDate !== undefined && { expectedCloseDate }),
    stage: nextStage,
    closedAt: closedAtFor(nextStage, current, now),
    updatedAt: stamp(now),
  };
  return {
    state: { ...state, deals: state.deals.map((item) => (item.id === id ? deal : item)) },
    result: deal,
  };
}

export function deleteDeal(state: DemoState, id: string): Change<void> {
  requireDeal(state, id);
  return {
    state: {
      ...state,
      deals: state.deals.filter((deal) => deal.id !== id),
      interactions: state.interactions.filter((interaction) => interaction.dealId !== id),
      deletedIds: deleted(state, id),
    },
    result: undefined,
  };
}

export function createInteraction(
  state: DemoState,
  dealId: string,
  body: CreateInteractionBody,
  now: Date,
): Change<Interaction> {
  requireDeal(state, dealId);
  const check = new Checker();
  const type = check.interactionType(body.type);
  const notes = check.requiredText("notes", "Notes", 5000, body.notes);
  const occurredAt = check.occurredAt(body.occurredAt, now);
  check.throwIfInvalid();
  const interaction: Interaction = {
    id: `new-interaction-${state.created.interactions + 1}`,
    dealId,
    type: type ?? "NOTE",
    notes: notes ?? "",
    occurredAt: occurredAt ?? stamp(now),
    createdAt: stamp(now),
    updatedAt: stamp(now),
  };
  return {
    state: {
      ...state,
      interactions: [...state.interactions, interaction],
      created: { ...state.created, interactions: state.created.interactions + 1 },
    },
    result: interaction,
  };
}

export function updateInteraction(
  state: DemoState,
  id: string,
  body: UpdateInteractionBody,
  now: Date,
): Change<Interaction> {
  const current = state.interactions.find((interaction) => interaction.id === id);
  if (!current) throw notFound(`Interaction ${id}`);
  const check = new Checker();
  const type = check.interactionType(body.type);
  const notes = check.requiredText("notes", "Notes", 5000, body.notes);
  const occurredAt = check.occurredAt(body.occurredAt, now);
  check.throwIfInvalid();
  const interaction: Interaction = {
    ...current,
    type: type ?? current.type,
    notes: notes ?? current.notes,
    occurredAt: occurredAt ?? current.occurredAt,
    updatedAt: stamp(now),
  };
  return {
    state: {
      ...state,
      interactions: state.interactions.map((item) => (item.id === id ? interaction : item)),
    },
    result: interaction,
  };
}

export function deleteInteraction(state: DemoState, id: string): Change<void> {
  if (!state.interactions.some((interaction) => interaction.id === id)) {
    throw notFound(`Interaction ${id}`);
  }
  return {
    state: {
      ...state,
      interactions: state.interactions.filter((interaction) => interaction.id !== id),
    },
    result: undefined,
  };
}
