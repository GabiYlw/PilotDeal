import { describe, expect, it } from "vitest";
import type { z } from "zod";
import { askRequestSchema } from "../../src/modules/ask/ask.schemas.js";
import { createCompanySchema } from "../../src/modules/companies/companies.schemas.js";
import { createContactSchema } from "../../src/modules/contacts/contacts.schemas.js";
import {
  createDealSchema,
  listDealsQuerySchema,
  updateDealSchema,
} from "../../src/modules/deals/deals.schemas.js";
import { createInteractionSchema } from "../../src/modules/interactions/interactions.schemas.js";
import { paginationQuerySchema } from "../../src/shared/pagination.js";
import { idParamsSchema, toIssueDetails } from "../../src/shared/validation.js";

// The web shows these messages next to the form fields as they are, so each one is pinned here.
function issuesOf(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected the input to be rejected");
  return toIssueDetails(result.error);
}

const DEAL = { title: "T", value: 1 };

describe("validation messages", () => {
  it.each<[string, z.ZodType, unknown, string, string]>([
    ["a missing company name", createCompanySchema, {}, "name", "Name is required"],
    ["a blank company name", createCompanySchema, { name: "  " }, "name", "Name is required"],
    ["a non-text name", createCompanySchema, { name: 5 }, "name", "Name must be text"],
    [
      "a 201-character name",
      createCompanySchema,
      { name: "a".repeat(201) },
      "name",
      "Name must be at most 200 characters",
    ],
    [
      "a blank industry",
      createCompanySchema,
      { name: "A", industry: " " },
      "industry",
      "Industry cannot be blank: leave it out or send null to clear it",
    ],
    [
      "a website without http",
      createCompanySchema,
      { name: "A", website: "acme.test" },
      "website",
      "Enter a valid URL starting with http:// or https://",
    ],
    [
      "an invalid email",
      createContactSchema,
      { name: "A", email: "a@b" },
      "email",
      "Enter a valid email address",
    ],
    [
      "a 51-character phone",
      createContactSchema,
      { name: "A", phone: "1".repeat(51) },
      "phone",
      "Phone must be at most 50 characters",
    ],
    ["a missing title", createDealSchema, { value: 1 }, "title", "Title is required"],
    ["a missing value", createDealSchema, { title: "T" }, "value", "Value is required"],
    [
      "a string value",
      createDealSchema,
      { ...DEAL, value: "100" },
      "value",
      "Value must be a number",
    ],
    [
      "a negative value",
      createDealSchema,
      { ...DEAL, value: -5 },
      "value",
      "Value must be 0 or more",
    ],
    [
      "a value above the maximum",
      createDealSchema,
      { ...DEAL, value: 10_000_000_000 },
      "value",
      "Value must be at most 9,999,999,999.99",
    ],
    [
      "3 decimals",
      createDealSchema,
      { ...DEAL, value: 1.234 },
      "value",
      "Use at most 2 decimal places",
    ],
    [
      "a lowercase stage",
      createDealSchema,
      { ...DEAL, stage: "won" },
      "stage",
      "Stage must be one of LEAD, QUALIFIED, PROPOSAL, NEGOTIATION, WON, LOST",
    ],
    [
      "an impossible date",
      createDealSchema,
      { ...DEAL, expectedCloseDate: "2026-02-30" },
      "expectedCloseDate",
      "Enter a valid date (YYYY-MM-DD)",
    ],
    [
      "a date before 1900",
      createDealSchema,
      { ...DEAL, expectedCloseDate: "1899-12-31" },
      "expectedCloseDate",
      "Date must be on or after 1900-01-01",
    ],
    [
      "an unknown interaction type",
      createInteractionSchema,
      { type: "SMS", notes: "x" },
      "type",
      "Type must be one of EMAIL, CALL, MEETING, NOTE",
    ],
    [
      "blank notes",
      createInteractionSchema,
      { type: "NOTE", notes: " " },
      "notes",
      "Notes is required",
    ],
    [
      "a datetime without offset",
      createInteractionSchema,
      { type: "NOTE", notes: "x", occurredAt: "2026-01-01T10:00:00" },
      "occurredAt",
      "Enter a valid date and time with a time zone offset",
    ],
    [
      "a future occurredAt",
      createInteractionSchema,
      { type: "NOTE", notes: "x", occurredAt: "2999-01-01T00:00:00Z" },
      "occurredAt",
      "Date cannot be in the future",
    ],
    ["a missing question", askRequestSchema, {}, "question", "Question is required"],
    [
      "a 2-character question",
      askRequestSchema,
      { question: "hi" },
      "question",
      "Question must be at least 3 characters",
    ],
    [
      "a fractional limit",
      askRequestSchema,
      { question: "Who?", limit: 1.5 },
      "limit",
      "Limit must be a whole number from 1 to 10",
    ],
    [
      "an invalid dealId",
      askRequestSchema,
      { question: "Who?", dealId: "x" },
      "dealId",
      "dealId must be a valid UUID",
    ],
    ["an invalid id param", idParamsSchema, { id: "x" }, "id", "id must be a valid UUID"],
    [
      "a zero pageSize",
      paginationQuerySchema,
      { pageSize: "0" },
      "pageSize",
      "pageSize must be a whole number from 1 to 100",
    ],
    [
      "an invalid companyId filter",
      listDealsQuerySchema,
      { companyId: "x" },
      "companyId",
      "companyId must be a valid UUID",
    ],
  ])("explains %s", (_case, schema, input, field, message) => {
    expect(issuesOf(schema, input)).toEqual([{ path: [field], message }]);
  });

  it.each([
    ["one unknown key", { ...DEAL, extra: 1 }, "Unknown field: extra"],
    ["two unknown keys", { ...DEAL, a: 1, b: 2 }, "Unknown fields: a, b"],
  ])("names the unknown keys in a request body with %s", (_case, input, message) => {
    expect(issuesOf(createDealSchema, input)).toEqual([{ path: [], message }]);
  });

  it("rejects a request body that is not an object", () => {
    expect(issuesOf(createDealSchema, [])).toEqual([
      { path: [], message: "The request body must be a JSON object" },
    ]);
  });

  it("keeps the readable message on an update schema", () => {
    expect(issuesOf(updateDealSchema, { value: -1 })).toEqual([
      { path: ["value"], message: "Value must be 0 or more" },
    ]);
  });
});
