import type { ValidationIssue } from "@/lib/types";
import { DEAL_STAGES, type DealStage, INTERACTION_TYPES, type InteractionType } from "@/lib/types";

// The API's request validation (its zod schemas in api/src/modules/*/…schemas.ts), restated for
// the fields the dashboard's forms send, with the same messages. The demo has no API to reject a
// value, so it checks here and reports issues in the API's error shape; the dashboard's forms
// then show them next to the fields exactly as they show the API's.

export const VALIDATION_ERROR = "VALIDATION_ERROR";
export const NOT_FOUND = "NOT_FOUND";
export const DEMO_LIMIT = "DEMO_LIMIT";

// Same fields as the API client's ApiError, so lib/form-state's toFormErrors reads it unchanged.
export class DemoApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "DemoApiError";
  }
}

export function notFound(what: string): DemoApiError {
  return new DemoApiError(`${what} not found`, 404, NOT_FOUND);
}

// Collects issues field by field, then throws them all at once, like a failed zod parse.
export class Checker {
  private readonly issues: ValidationIssue[] = [];

  private fail(field: string, message: string): undefined {
    this.issues.push({ path: [field], message });
    return undefined;
  }

  requiredText(field: string, label: string, max: number, value: string): string | undefined {
    const trimmed = value.trim();
    if (trimmed === "") return this.fail(field, `${label} is required`);
    if (trimmed.length > max) return this.fail(field, `${label} must be at most ${max} characters`);
    return trimmed;
  }

  // null (an empty form field) clears the value.
  optionalText(field: string, label: string, max: number, value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    if (trimmed.length > max) {
      this.fail(field, `${label} must be at most ${max} characters`);
    }
    return trimmed;
  }

  website(value: string | null): string | null {
    if (value === null) return null;
    if (!isHttpUrl(value)) {
      this.fail("website", "Enter a valid URL starting with http:// or https://");
    } else if (value.length > 2048) {
      this.fail("website", "Website must be at most 2048 characters");
    }
    return value;
  }

  email(value: string | null): string | null {
    if (value === null) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      this.fail("email", "Enter a valid email address");
    } else if (value.length > 320) {
      this.fail("email", "Email must be at most 320 characters");
    }
    return value;
  }

  // The form sends a number, or the raw text when it is not numeric.
  dealValue(value: number | string | undefined, required: boolean): number | undefined {
    if (value === undefined) {
      return required ? this.fail("value", "Value is required") : undefined;
    }
    if (typeof value === "string") return this.fail("value", "Value must be a number");
    if (value < 0) return this.fail("value", "Value must be 0 or more");
    if (value > 9_999_999_999.99) {
      return this.fail("value", "Value must be at most 9,999,999,999.99");
    }
    if (!/^\d+(\.\d{1,2})?$/.test(String(value))) {
      return this.fail("value", "Use at most 2 decimal places");
    }
    return value;
  }

  stage(value: string): DealStage | undefined {
    if ((DEAL_STAGES as readonly string[]).includes(value)) return value as DealStage;
    return this.fail("stage", `Stage must be one of ${DEAL_STAGES.join(", ")}`);
  }

  closeDate(value: string | null | undefined): string | null | undefined {
    if (value === null || value === undefined) return value;
    if (!isIsoDate(value)) return this.fail("expectedCloseDate", "Enter a valid date (YYYY-MM-DD)");
    if (value < "1900-01-01") {
      return this.fail("expectedCloseDate", "Date must be on or after 1900-01-01");
    }
    return value;
  }

  interactionType(value: string): InteractionType | undefined {
    if ((INTERACTION_TYPES as readonly string[]).includes(value)) return value as InteractionType;
    return this.fail("type", `Type must be one of ${INTERACTION_TYPES.join(", ")}`);
  }

  occurredAt(value: string | undefined, now: Date): string | undefined {
    if (value === undefined) return undefined;
    const time = Date.parse(value);
    if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(value) || Number.isNaN(time)) {
      return this.fail("occurredAt", "Enter a valid date and time with a time zone offset");
    }
    if (time < Date.UTC(1900, 0, 1)) {
      return this.fail("occurredAt", "Date must be on or after 1900-01-01");
    }
    if (time > now.getTime()) return this.fail("occurredAt", "Date cannot be in the future");
    return new Date(time).toISOString();
  }

  throwIfInvalid(): void {
    if (this.issues.length > 0) {
      throw new DemoApiError("Invalid request body", 400, VALIDATION_ERROR, this.issues);
    }
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

// A real calendar date: 2026-02-30 is rejected like the API's z.iso.date().
function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
