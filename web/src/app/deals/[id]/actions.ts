"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import {
  ApiError,
  createDealInteraction,
  deleteDeal,
  deleteInteraction,
  updateDeal,
  updateInteraction,
} from "@/lib/api";
import { type DealDeletedOutcome, dealDeletedUrl } from "@/lib/deal-deleted";
import {
  type ActionState,
  type DealEditField,
  type FormState,
  type InteractionField,
  type StageField,
  toFormErrors,
} from "@/lib/form-state";
import { text, toDealValue } from "@/lib/form-data";
import { toDateInputValue } from "@/lib/format";
import { DELETE_FAILED_MESSAGE, INTERACTION_NOT_FOUND_MESSAGE } from "@/lib/messages";

const INTERACTION_FIELDS = ["type", "notes", "occurredAt"] as const;
const STAGE_FIELDS = ["stage"] as const;
const DEAL_EDIT_FIELDS = ["title", "value", "expectedCloseDate"] as const;
const NO_FIELDS = [] as const;

// The date input gives YYYY-MM-DD; the API wants a timestamp with an offset. Anything else is
// passed through unchanged so the API reports it.
function toOccurredAt(date: string): string | undefined {
  if (date === "") return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00.000Z` : date;
}

// The edit form always shows a date. An unchanged date is left out of the PATCH body, so the
// original time of day (and the timeline order) is kept; a changed one becomes UTC midnight.
function changedOccurredAt(date: string, original: string): string | undefined {
  return date === "" || date === toDateInputValue(original) ? undefined : toOccurredAt(date);
}

function revalidateDeal(dealId: string): void {
  revalidatePath(`/deals/${dealId}`);
  revalidatePath("/deals");
}

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
  try {
    await createDealInteraction(dealId, {
      type: values.type,
      notes: values.notes,
      ...(occurredAt !== undefined && { occurredAt }),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return { status: "error", ...toFormErrors(error, INTERACTION_FIELDS), values };
    }
    throw error;
  }
  revalidateDeal(dealId);
  return { status: "success", fieldErrors: {} };
}

export async function updateDealStage(
  dealId: string,
  _previous: FormState<StageField>,
  formData: FormData,
): Promise<FormState<StageField>> {
  const values = { stage: text(formData, "stage") };
  try {
    await updateDeal(dealId, { stage: values.stage });
  } catch (error) {
    if (error instanceof ApiError) {
      return { status: "error", ...toFormErrors(error, STAGE_FIELDS), values };
    }
    throw error;
  }
  revalidateDeal(dealId);
  return { status: "success", fieldErrors: {} };
}

// Sends title, value and the date, never the stage (that has its own form). An empty date is null,
// which clears it; an untouched empty date is already null, so that is a no-op.
export async function editDeal(
  dealId: string,
  companyId: string,
  _previous: FormState<DealEditField>,
  formData: FormData,
): Promise<FormState<DealEditField>> {
  const values = {
    title: text(formData, "title"),
    value: text(formData, "value"),
    expectedCloseDate: text(formData, "expectedCloseDate"),
  };
  const value = toDealValue(values.value);
  try {
    await updateDeal(dealId, {
      title: values.title,
      ...(value !== undefined && { value }),
      expectedCloseDate: values.expectedCloseDate === "" ? null : values.expectedCloseDate,
    });
  } catch (error) {
    if (error instanceof ApiError) {
      return { status: "error", ...toFormErrors(error, DEAL_EDIT_FIELDS), values };
    }
    throw error;
  }
  revalidateDeal(dealId);
  revalidatePath(`/companies/${companyId}`);
  return { status: "success", fieldErrors: {} };
}

export async function editInteraction(
  dealId: string,
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
  try {
    await updateInteraction(interactionId, {
      type: values.type,
      notes: values.notes,
      ...(occurredAt !== undefined && { occurredAt }),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const errors = toFormErrors(error, INTERACTION_FIELDS, {
        notFound: INTERACTION_NOT_FOUND_MESSAGE,
      });
      return { status: "error", ...errors, values };
    }
    throw error;
  }
  revalidateDeal(dealId);
  return { status: "success", fieldErrors: {} };
}

// A 404 here does not revalidate: the page would otherwise drop the item (and its message) at
// once, or, if the whole deal is gone, swap the page for the not-found screen mid-action.
export async function removeInteraction(
  dealId: string,
  interactionId: string,
): Promise<ActionState> {
  try {
    await deleteInteraction(interactionId);
  } catch (error) {
    if (error instanceof ApiError) {
      const errors = toFormErrors(error, NO_FIELDS, {
        notFound: INTERACTION_NOT_FOUND_MESSAGE,
        failed: DELETE_FAILED_MESSAGE,
      });
      return { status: "error", ...errors };
    }
    throw error;
  }
  revalidateDeal(dealId);
  return { status: "success", fieldErrors: {} };
}

export async function removeDeal(dealId: string): Promise<ActionState> {
  let outcome: DealDeletedOutcome = "deleted";
  try {
    await deleteDeal(dealId);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status !== 404) {
      return { status: "error", ...toFormErrors(error, NO_FIELDS, { failed: DELETE_FAILED_MESSAGE }) };
    }
    // The deal is gone either way, and the user is on a page for a deal that no longer exists:
    // the list is where they need to be.
    outcome = "already";
  }
  revalidateDeal(dealId);
  // Outside the try: redirect works by throwing, and a catch would swallow it.
  redirect(dealDeletedUrl(outcome), RedirectType.replace);
}
