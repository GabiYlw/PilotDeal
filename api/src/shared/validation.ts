import { z } from "zod";
import { ValidationError } from "./errors.js";

export const INVALID_PARAMS_MESSAGE = "Invalid route parameters";
export const INVALID_QUERY_MESSAGE = "Invalid query parameters";
export const INVALID_BODY_MESSAGE = "Invalid request body";

export interface IssueDetail {
  path: (string | number)[];
  message: string;
}

export function toIssueDetails(error: z.ZodError): IssueDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) => (typeof segment === "symbol" ? String(segment) : segment)),
    message: issue.message,
  }));
}

// Parses untrusted input and throws a ValidationError (HTTP 400) on failure.
export function parseOrThrow<S extends z.ZodType>(
  schema: S,
  value: unknown,
  message: string,
): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ValidationError(message, toIssueDetails(result.error));
  }
  return result.data;
}

// Validation messages are shown next to the web form fields as they are, so they are written
// for people, not in zod's default wording ("Too small: expected string to have >=1 characters").

function uuidParam(name: string) {
  return z.uuid({ error: `${name} must be a valid UUID` });
}

export const idParamsSchema = z.object({ id: uuidParam("id") });
export const companyIdParamsSchema = z.object({ companyId: uuidParam("companyId") });
export const dealIdParamsSchema = z.object({ dealId: uuidParam("dealId") });

function bodyIssueMessage(issue: z.core.$ZodRawIssue): string | undefined {
  if (issue.code === "unrecognized_keys") {
    return `Unknown field${issue.keys.length > 1 ? "s" : ""}: ${issue.keys.join(", ")}`;
  }
  if (issue.code === "invalid_type") return "The request body must be a JSON object";
  return undefined;
}

// A request body that rejects unknown keys, with a readable message for them.
export function strictBody<Shape extends z.core.$ZodLooseShape>(shape: Shape) {
  return z.strictObject(shape, { error: bodyIssueMessage });
}

// Trimmed, non-empty text.
export function requiredText(label: string, max: number) {
  return z
    .string({
      error: (issue) => (issue.input === undefined ? `${label} is required` : `${label} must be text`),
    })
    .trim()
    .min(1, { error: `${label} is required` })
    .max(max, { error: `${label} must be at most ${max} characters` });
}

// Trimmed, non-empty text that may be omitted or set to null (null clears it).
export function optionalText(label: string, max: number) {
  return z
    .string({ error: `${label} must be text or null` })
    .trim()
    .min(1, { error: `${label} cannot be blank: leave it out or send null to clear it` })
    .max(max, { error: `${label} must be at most ${max} characters` })
    .nullable()
    .optional();
}

export const nameSchema = requiredText("Name", 200);
