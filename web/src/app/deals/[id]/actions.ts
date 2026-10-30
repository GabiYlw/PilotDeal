"use server";

import { revalidatePath } from "next/cache";
import { ApiError, createDealInteraction, updateDeal } from "@/lib/api";
import { type FormState, type InteractionField, type StageField, toFormErrors } from "@/lib/form-state";

const INTERACTION_FIELDS = ["type", "notes", "occurredAt"] as const;
const STAGE_FIELDS = ["stage"] as const;

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// The date input gives YYYY-MM-DD; the API wants a timestamp with an offset. Anything else is
// passed through unchanged so the API reports it.
function toOccurredAt(date: string): string | undefined {
  if (date === "") return undefined;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T00:00:00.000Z` : date;
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
