// Type-only import: this module is also bundled for Client Components, which must not pull in
// the server-only API client.
import type { ApiError } from "./api";
import { API_NOT_RUNNING_MESSAGE } from "./messages";

export interface FormState<F extends string> {
  status: "idle" | "success" | "error";
  fieldErrors: Partial<Record<F, string>>;
  formError?: string;
  values?: Partial<Record<F, string>>;
}

export type InteractionField = "type" | "notes" | "occurredAt";
export type StageField = "stage";

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

export function toFormErrors<F extends string>(
  error: ApiError,
  fields: readonly F[],
): FormErrors<F> {
  if (error.status === 400) {
    return validationErrors(error.details, fields, error.message);
  }
  if (error.status === 0) return { fieldErrors: {}, formError: API_NOT_RUNNING_MESSAGE };
  if (error.status === 404) return { fieldErrors: {}, formError: "This deal no longer exists." };
  return { fieldErrors: {}, formError: "Could not save. Please try again." };
}
