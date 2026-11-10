"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ApiError, createCompany } from "@/lib/api";
import { nullableText, text } from "@/lib/form-data";
import { SAVE_FAILED_MESSAGE } from "@/lib/messages";
import { type CompanyField, type FormState, toFormErrors } from "@/lib/form-state";
import type { Company } from "@/lib/types";

const COMPANY_FIELDS = ["name", "industry", "website"] as const;

export async function addCompany(
  _previous: FormState<CompanyField>,
  formData: FormData,
): Promise<FormState<CompanyField>> {
  const values = {
    name: text(formData, "name"),
    industry: text(formData, "industry"),
    website: text(formData, "website"),
  };
  let company: Company;
  try {
    company = await createCompany({
      name: values.name,
      industry: nullableText(values.industry),
      website: nullableText(values.website),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      const errors = toFormErrors(error, COMPANY_FIELDS, { notFound: SAVE_FAILED_MESSAGE });
      return { status: "error", ...errors, values };
    }
    throw error;
  }
  revalidatePath("/clients");
  // Outside the try: redirect works by throwing, and a catch would swallow it.
  redirect(`/clients/${company.id}`);
}
