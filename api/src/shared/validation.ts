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

export const idParamsSchema = z.object({ id: z.uuid() });
export const companyIdParamsSchema = z.object({ companyId: z.uuid() });

// Trimmed, non-empty text that may be omitted or set to null.
export function optionalText(max: number) {
  return z.string().trim().min(1).max(max).nullable().optional();
}

export const nameSchema = z.string().trim().min(1).max(200);
