"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import {
  ApiError,
  createCompanyContact,
  createCompanyDeal,
  deleteCompany,
  deleteContact,
  updateCompany,
  updateContact,
} from "@/lib/api";
import { type CompanyDeletedOutcome, companyDeletedUrl } from "@/lib/company-deleted";
import { nullableText, text, toDealValue } from "@/lib/form-data";
import {
  type ActionState,
  type CompanyField,
  type ContactField,
  type DealField,
  type FormState,
  toFormErrors,
} from "@/lib/form-state";
import {
  COMPANY_NOT_FOUND_MESSAGE,
  CONTACT_NOT_FOUND_MESSAGE,
  DELETE_FAILED_MESSAGE,
} from "@/lib/messages";
import type { Deal } from "@/lib/types";

const COMPANY_FIELDS = ["name", "industry", "website"] as const;
const CONTACT_FIELDS = ["name", "email", "phone", "role"] as const;
const DEAL_FIELDS = ["title", "value", "stage", "expectedCloseDate"] as const;
const NO_FIELDS = [] as const;

function revalidateCompany(companyId: string): void {
  revalidatePath(`/companies/${companyId}`);
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

// A 404 does not revalidate (here and in the other actions below): the page would otherwise swap
// to the not-found screen, or drop the item and its message, in the middle of the action.
export async function editCompany(
  companyId: string,
  _previous: FormState<CompanyField>,
  formData: FormData,
): Promise<FormState<CompanyField>> {
  const values = {
    name: text(formData, "name"),
    industry: text(formData, "industry"),
    website: text(formData, "website"),
  };
  try {
    await updateCompany(companyId, {
      name: values.name,
      industry: nullableText(values.industry),
      website: nullableText(values.website),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const errors = toFormErrors(error, COMPANY_FIELDS, { notFound: COMPANY_NOT_FOUND_MESSAGE });
      return { status: "error", ...errors, values };
    }
    throw error;
  }
  revalidateCompany(companyId);
  revalidatePath("/companies");
  return { status: "success", fieldErrors: {} };
}

export async function removeCompany(companyId: string): Promise<ActionState> {
  let outcome: CompanyDeletedOutcome = "deleted";
  try {
    await deleteCompany(companyId);
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    if (error.status !== 404) {
      return {
        status: "error",
        ...toFormErrors(error, NO_FIELDS, { failed: DELETE_FAILED_MESSAGE }),
      };
    }
    // The company is gone either way, and the user is on a page for one that no longer exists:
    // the list is where they need to be.
    outcome = "already";
  }
  // The delete cascades to the company's deals, so the deals list changes too.
  revalidatePath("/companies");
  revalidatePath("/deals");
  // Outside the try: redirect works by throwing, and a catch would swallow it.
  redirect(companyDeletedUrl(outcome), RedirectType.replace);
}

export async function addContact(
  companyId: string,
  _previous: FormState<ContactField>,
  formData: FormData,
): Promise<FormState<ContactField>> {
  const values = contactValues(formData);
  try {
    await createCompanyContact(companyId, contactBody(values));
  } catch (error) {
    if (error instanceof ApiError) {
      const errors = toFormErrors(error, CONTACT_FIELDS, { notFound: COMPANY_NOT_FOUND_MESSAGE });
      return { status: "error", ...errors, values };
    }
    throw error;
  }
  revalidateCompany(companyId);
  return { status: "success", fieldErrors: {} };
}

export async function editContact(
  companyId: string,
  contactId: string,
  _previous: FormState<ContactField>,
  formData: FormData,
): Promise<FormState<ContactField>> {
  const values = contactValues(formData);
  try {
    await updateContact(contactId, contactBody(values));
  } catch (error) {
    if (error instanceof ApiError) {
      const errors = toFormErrors(error, CONTACT_FIELDS, { notFound: CONTACT_NOT_FOUND_MESSAGE });
      return { status: "error", ...errors, values };
    }
    throw error;
  }
  revalidateCompany(companyId);
  return { status: "success", fieldErrors: {} };
}

export async function removeContact(companyId: string, contactId: string): Promise<ActionState> {
  try {
    await deleteContact(contactId);
  } catch (error) {
    if (error instanceof ApiError) {
      const errors = toFormErrors(error, NO_FIELDS, {
        notFound: CONTACT_NOT_FOUND_MESSAGE,
        failed: DELETE_FAILED_MESSAGE,
      });
      return { status: "error", ...errors };
    }
    throw error;
  }
  revalidateCompany(companyId);
  return { status: "success", fieldErrors: {} };
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
  let deal: Deal;
  try {
    deal = await createCompanyDeal(companyId, {
      title: values.title,
      stage: values.stage,
      ...(value !== undefined && { value }),
      ...(values.expectedCloseDate !== "" && { expectedCloseDate: values.expectedCloseDate }),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const errors = toFormErrors(error, DEAL_FIELDS, { notFound: COMPANY_NOT_FOUND_MESSAGE });
      return { status: "error", ...errors, values };
    }
    throw error;
  }
  revalidateCompany(companyId);
  revalidatePath("/deals");
  redirect(`/deals/${deal.id}`);
}
