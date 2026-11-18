import { companyDeletedUrl } from "@/lib/company-deleted";
import { dealDeletedUrl } from "@/lib/deal-deleted";
import { nullableText, text, toDealValue } from "@/lib/form-data";
import {
  type ActionState,
  type CompanyField,
  type ContactField,
  type DealEditField,
  type DealField,
  type FormState,
  type InteractionField,
  type StageField,
  toFormErrors,
} from "@/lib/form-state";
import { toDateInputValue } from "@/lib/format";
import {
  COMPANY_NOT_FOUND_MESSAGE,
  CONTACT_NOT_FOUND_MESSAGE,
  DELETE_FAILED_MESSAGE,
  INTERACTION_NOT_FOUND_MESSAGE,
  SAVE_FAILED_MESSAGE,
} from "@/lib/messages";
import * as mutations from "./mutations";
import { navigate } from "./navigation";
import { commit } from "./store";
import { DEMO_LIMIT, DemoApiError } from "./validation";

// The demo's stand-ins for the Server Actions in app/clients/**/actions.ts and
// app/deals/[id]/actions.ts: same arguments, same returned form state, so the dashboard's forms use
// them unchanged. They read the form the same way, then change the in-memory store instead of
// calling the API. Kept in the order of those files.

const COMPANY_FIELDS = ["name", "industry", "website"] as const;
const CONTACT_FIELDS = ["name", "email", "phone", "role"] as const;
const DEAL_FIELDS = ["title", "value", "stage", "expectedCloseDate"] as const;
const DEAL_EDIT_FIELDS = ["title", "value", "expectedCloseDate"] as const;
const INTERACTION_FIELDS = ["type", "notes", "occurredAt"] as const;
const STAGE_FIELDS = ["stage"] as const;
const NO_FIELDS = [] as const;

const SUCCESS = { status: "success", fieldErrors: {} } as const;

interface Messages {
  notFound?: string;
  failed?: string;
}

// Runs one store change. A DemoApiError becomes the form's error state, like an ApiError in the
// real actions; the demo's own limit (a full id pool) is shown as written.
function attempt<F extends string, T>(
  change: () => T,
  fields: readonly F[],
  messages: Messages,
):
  { ok: true; result: T } | { ok: false; errors: Pick<FormState<F>, "fieldErrors" | "formError"> } {
  try {
    return { ok: true, result: change() };
  } catch (error) {
    if (!(error instanceof DemoApiError)) throw error;
    if (error.code === DEMO_LIMIT) {
      return { ok: false, errors: { fieldErrors: {}, formError: error.message } };
    }
    return { ok: false, errors: toFormErrors(error, fields, messages) };
  }
}

function companyValues(formData: FormData) {
  return {
    name: text(formData, "name"),
    industry: text(formData, "industry"),
    website: text(formData, "website"),
  };
}

function companyBody(values: ReturnType<typeof companyValues>) {
  return {
    name: values.name,
    industry: nullableText(values.industry),
    website: nullableText(values.website),
  };
}

function contactValues(formData: FormData) {
  return {
    name: text(formData, "name"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    role: text(formData, "role"),
  };
}

function contactBody(values: ReturnType<typeof contactValues>) {
  return {
    name: values.name,
    email: nullableText(values.email),
    phone: nullableText(values.phone),
    role: nullableText(values.role),
  };
}

// The date input gives YYYY-MM-DD; the API wants a timestamp with an offset.
function toOccurredAt(date: string): string | undefined {
  if (date === "") return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00.000Z` : date;
}

// An unchanged date keeps the original time of day (and the timeline order).
function changedOccurredAt(date: string, original: string): string | undefined {
  return date === "" || date === toDateInputValue(original) ? undefined : toOccurredAt(date);
}

// --- Clients (app/clients/new/actions.ts and app/clients/[id]/actions.ts) ---

export async function addCompany(
  _previous: FormState<CompanyField>,
  formData: FormData,
): Promise<FormState<CompanyField>> {
  const values = companyValues(formData);
  const outcome = attempt(
    () => commit((state) => mutations.createCompany(state, companyBody(values), new Date())),
    COMPANY_FIELDS,
    { notFound: SAVE_FAILED_MESSAGE },
  );
  if (!outcome.ok) return { status: "error", ...outcome.errors, values };
  navigate(`/clients/${outcome.result.id}`);
  return SUCCESS;
}

export async function editCompany(
  companyId: string,
  _previous: FormState<CompanyField>,
  formData: FormData,
): Promise<FormState<CompanyField>> {
  const values = companyValues(formData);
  const outcome = attempt(
    () =>
      commit((state) => mutations.updateCompany(state, companyId, companyBody(values), new Date())),
    COMPANY_FIELDS,
    { notFound: COMPANY_NOT_FOUND_MESSAGE },
  );
  return outcome.ok ? SUCCESS : { status: "error", ...outcome.errors, values };
}

export async function removeCompany(companyId: string): Promise<ActionState> {
  const outcome = attempt(
    () => commit((state) => mutations.deleteCompany(state, companyId)),
    NO_FIELDS,
    { failed: DELETE_FAILED_MESSAGE },
  );
  // Already gone counts as deleted, like the real action's "already" outcome.
  navigate(companyDeletedUrl(outcome.ok ? "deleted" : "already"), { replace: true });
  return SUCCESS;
}

export async function addContact(
  companyId: string,
  _previous: FormState<ContactField>,
  formData: FormData,
): Promise<FormState<ContactField>> {
  const values = contactValues(formData);
  const outcome = attempt(
    () =>
      commit((state) => mutations.createContact(state, companyId, contactBody(values), new Date())),
    CONTACT_FIELDS,
    { notFound: COMPANY_NOT_FOUND_MESSAGE },
  );
  return outcome.ok ? SUCCESS : { status: "error", ...outcome.errors, values };
}

export async function editContact(
  _companyId: string,
  contactId: string,
  _previous: FormState<ContactField>,
  formData: FormData,
): Promise<FormState<ContactField>> {
  const values = contactValues(formData);
  const outcome = attempt(
    () =>
      commit((state) => mutations.updateContact(state, contactId, contactBody(values), new Date())),
    CONTACT_FIELDS,
    { notFound: CONTACT_NOT_FOUND_MESSAGE },
  );
  return outcome.ok ? SUCCESS : { status: "error", ...outcome.errors, values };
}

export async function removeContact(_companyId: string, contactId: string): Promise<ActionState> {
  const outcome = attempt(
    () => commit((state) => mutations.deleteContact(state, contactId)),
    NO_FIELDS,
    { notFound: CONTACT_NOT_FOUND_MESSAGE, failed: DELETE_FAILED_MESSAGE },
  );
  return outcome.ok ? SUCCESS : { status: "error", ...outcome.errors };
}

export async function addDeal(
  companyId: string,
  _previous: FormState<DealField>,
  formData: FormData,
): Promise<FormState<DealField>> {
  const values = {
    title: text(formData, "title"),
    value: text(formData, "value"),
    stage: text(formData, "stage"),
    expectedCloseDate: text(formData, "expectedCloseDate"),
  };
  const value = toDealValue(values.value);
  const outcome = attempt(
    () =>
      commit((state) =>
        mutations.createDeal(
          state,
          companyId,
          {
            title: values.title,
            stage: values.stage,
            ...(value !== undefined && { value }),
            ...(values.expectedCloseDate !== "" && { expectedCloseDate: values.expectedCloseDate }),
          },
          new Date(),
        ),
      ),
    DEAL_FIELDS,
    { notFound: COMPANY_NOT_FOUND_MESSAGE },
  );
  if (!outcome.ok) return { status: "error", ...outcome.errors, values };
  navigate(`/deals/${outcome.result.id}`);
  return SUCCESS;
}

// --- Deals (app/deals/[id]/actions.ts) ---

export async function addInteraction(
  dealId: string,
  _previous: FormState<InteractionField>,
  formData: FormData,
): Promise<FormState<InteractionField>> {
  const values = {
    type: text(formData, "type"),
    notes: text(formData, "notes"),
    occurredAt: text(formData, "occurredAt"),
  };
  const occurredAt = toOccurredAt(values.occurredAt);
  const outcome = attempt(
    () =>
      commit((state) =>
        mutations.createInteraction(
          state,
          dealId,
          {
            type: values.type,
            notes: values.notes,
            ...(occurredAt !== undefined && { occurredAt }),
          },
          new Date(),
        ),
      ),
    INTERACTION_FIELDS,
    {},
  );
  return outcome.ok ? SUCCESS : { status: "error", ...outcome.errors, values };
}

export async function updateDealStage(
  dealId: string,
  _previous: FormState<StageField>,
  formData: FormData,
): Promise<FormState<StageField>> {
  const values = { stage: text(formData, "stage") };
  const outcome = attempt(
    () => commit((state) => mutations.updateDeal(state, dealId, values, new Date())),
    STAGE_FIELDS,
    {},
  );
  return outcome.ok ? SUCCESS : { status: "error", ...outcome.errors, values };
}

export async function editDeal(
  dealId: string,
  _companyId: string,
  _previous: FormState<DealEditField>,
  formData: FormData,
): Promise<FormState<DealEditField>> {
  const values = {
    title: text(formData, "title"),
    value: text(formData, "value"),
    expectedCloseDate: text(formData, "expectedCloseDate"),
  };
  const value = toDealValue(values.value);
  const outcome = attempt(
    () =>
      commit((state) =>
        mutations.updateDeal(
          state,
          dealId,
          {
            title: values.title,
            ...(value !== undefined && { value }),
            expectedCloseDate: values.expectedCloseDate === "" ? null : values.expectedCloseDate,
          },
          new Date(),
        ),
      ),
    DEAL_EDIT_FIELDS,
    {},
  );
  return outcome.ok ? SUCCESS : { status: "error", ...outcome.errors, values };
}

export async function editInteraction(
  _dealId: string,
  interactionId: string,
  originalOccurredAt: string,
  _previous: FormState<InteractionField>,
  formData: FormData,
): Promise<FormState<InteractionField>> {
  const values = {
    type: text(formData, "type"),
    notes: text(formData, "notes"),
    occurredAt: text(formData, "occurredAt"),
  };
  const occurredAt = changedOccurredAt(values.occurredAt, originalOccurredAt);
  const outcome = attempt(
    () =>
      commit((state) =>
        mutations.updateInteraction(
          state,
          interactionId,
          {
            type: values.type,
            notes: values.notes,
            ...(occurredAt !== undefined && { occurredAt }),
          },
          new Date(),
        ),
      ),
    INTERACTION_FIELDS,
    { notFound: INTERACTION_NOT_FOUND_MESSAGE },
  );
  return outcome.ok ? SUCCESS : { status: "error", ...outcome.errors, values };
}

export async function removeInteraction(
  _dealId: string,
  interactionId: string,
): Promise<ActionState> {
  const outcome = attempt(
    () => commit((state) => mutations.deleteInteraction(state, interactionId)),
    NO_FIELDS,
    { notFound: INTERACTION_NOT_FOUND_MESSAGE, failed: DELETE_FAILED_MESSAGE },
  );
  return outcome.ok ? SUCCESS : { status: "error", ...outcome.errors };
}

export async function removeDeal(dealId: string): Promise<ActionState> {
  const outcome = attempt(() => commit((state) => mutations.deleteDeal(state, dealId)), NO_FIELDS, {
    failed: DELETE_FAILED_MESSAGE,
  });
  navigate(dealDeletedUrl(outcome.ok ? "deleted" : "already"), { replace: true });
  return SUCCESS;
}
