// Type-only import: this module is also bundled for Client Components, which must not pull in
// the server-only API client.
import type { ApiError } from "./api";
import { API_NOT_RUNNING_MESSAGE, DEAL_NOT_FOUND_MESSAGE, SAVE_FAILED_MESSAGE } from "./messages";

export interface FormState<F extends string> {
  status: "idle" | "success" | "error";
  fieldErrors: Partial<Record<F, string>>;
  formError?: string;
  values?: Partial<Record<F, string>>;
}

export type AskField = "question";
export type InteractionField = "type" | "notes" | "occurredAt";
export type StageField = "stage";
export type CompanyField = "name" | "industry" | "website";
export type ContactField = "name" | "email" | "phone" | "role";
export type DealField = "title" | "value" | "stage" | "expectedCloseDate";
export type DealEditField = Exclude<DealField, "stage">;
// For actions without form fields (confirmed deletes): only a status and an optional message.
export type ActionState = FormState<never>;

export function initialFormState<F extends string>(): FormState<F> {
  return { status: "idle", fieldErrors: {} };
}

type FormErrors<F extends string> = Pick<FormState<F>, "fieldErrors" | "formError">;

interface Issue {
  path: unknown[];
  message: string;
}

function isIssue(value: unknown): value is Issue {
  return (
    typeof value === "object" &&
    value !== null &&
    "path" in value &&
    Array.isArray(value.path) &&
    "message" in value &&
    typeof value.message === "string"
  );
}

function validationErrors<F extends string>(
  details: unknown,
  fields: readonly F[],
  fallbackMessage: string,
): FormErrors<F> {
  if (!Array.isArray(details) || !details.every(isIssue)) {
    return { fieldErrors: {}, formError: fallbackMessage };
  }
  const fieldErrors: Partial<Record<F, string>> = {};
  const leftovers: string[] = [];
  for (const issue of details) {
    const field = fields.find((name) => name === issue.path[0]);
    if (field === undefined) {
      leftovers.push(issue.message);
    } else if (fieldErrors[field] === undefined) {
      fieldErrors[field] = issue.message;
    }
  }
  const formError = leftovers.length > 0 ? leftovers.join(" ") : undefined;
  if (Object.keys(fieldErrors).length === 0 && formError === undefined) {
    return { fieldErrors, formError: fallbackMessage };
  }
  return { fieldErrors, formError };
}

interface ErrorMessages {
  notFound: string;
  failed: string;
}

export function toFormErrors<F extends string>(
  error: ApiError,
  fields: readonly F[],
  messages: Partial<ErrorMessages> = {},
): FormErrors<F> {
  if (error.status === 400) {
    return validationErrors(error.details, fields, error.message);
  }
  if (error.status === 0) return { fieldErrors: {}, formError: API_NOT_RUNNING_MESSAGE };
  if (error.status === 404) {
    return { fieldErrors: {}, formError: messages.notFound ?? DEAL_NOT_FOUND_MESSAGE };
  }
  return { fieldErrors: {}, formError: messages.failed ?? SAVE_FAILED_MESSAGE };
}
