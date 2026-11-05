import { describe, expect, it } from "vitest";
import {
  createDealSchema,
  listDealsQuerySchema,
  updateDealSchema,
} from "../../src/modules/deals/deals.schemas.js";

const validCompanyId = "22222222-2222-4222-8222-222222222222";

describe("createDealSchema", () => {
  it("defaults stage to LEAD and trims the title", () => {
    const result = createDealSchema.safeParse({ title: "  Big deal ", value: 10 });

    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ title: "Big deal", stage: "LEAD" });
  });

  it.each([0, 0.01, 12.3, 5.1, 48500.5, 9_999_999_999.99])("accepts value %s", (value) => {
    expect(createDealSchema.safeParse({ title: "T", value }).success).toBe(true);
  });

  it.each([-0.01, 10_000_000_000, 12.345, 0.1 + 0.2, 1e-7, "100", null, undefined])(
    "rejects value %s",
    (value) => {
      expect(createDealSchema.safeParse({ title: "T", value }).success).toBe(false);
    },
  );

  it.each([
    ["an empty title", { title: "", value: 1 }],
    ["a whitespace title", { title: "   ", value: 1 }],
    ["a 201-character title", { title: "a".repeat(201), value: 1 }],
    ["a lowercase stage", { title: "T", value: 1, stage: "won" }],
    ["a null stage", { title: "T", value: 1, stage: null }],
    ["a companyId", { title: "T", value: 1, companyId: validCompanyId }],
    ["a closedAt", { title: "T", value: 1, closedAt: "2026-01-01T00:00:00Z" }],
    ["an id", { title: "T", value: 1, id: validCompanyId }],
    ["an unknown key", { title: "T", value: 1, extra: true }],
  ])("rejects %s", (_name, body) => {
    expect(createDealSchema.safeParse(body).success).toBe(false);
  });

  it("accepts a 200-character title", () => {
    expect(createDealSchema.safeParse({ title: "a".repeat(200), value: 1 }).success).toBe(true);
  });

  it.each(["2024-02-29", "2026-12-31", "1900-01-01"])("accepts expectedCloseDate %s", (date) => {
    expect(
      createDealSchema.safeParse({ title: "T", value: 1, expectedCloseDate: date }).success,
    ).toBe(true);
  });

  it.each([
    "2025-02-29",
    "2026-02-30",
    "2026-13-01",
    "2026-1-5",
    "31-12-2026",
    "2026-12-31T00:00:00Z",
    "1899-12-31",
  ])("rejects expectedCloseDate %s", (date) => {
    expect(
      createDealSchema.safeParse({ title: "T", value: 1, expectedCloseDate: date }).success,
    ).toBe(false);
  });

  it("accepts a null expectedCloseDate", () => {
    expect(
      createDealSchema.safeParse({ title: "T", value: 1, expectedCloseDate: null }).success,
    ).toBe(true);
  });
});

describe("updateDealSchema", () => {
  it("rejects an empty object", () => {
    expect(updateDealSchema.safeParse({}).success).toBe(false);
  });

  it("does not apply the LEAD default to a missing stage", () => {
    const result = updateDealSchema.safeParse({ title: "New" });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ title: "New" });
  });

  it("accepts null to clear expectedCloseDate", () => {
    expect(updateDealSchema.safeParse({ expectedCloseDate: null }).success).toBe(true);
  });

  it.each([
    { title: "" },
    { value: -1 },
    { value: 1.234 },
    { value: null },
    { stage: "CLOSED" },
    { stage: null },
    { companyId: validCompanyId },
    { closedAt: null },
    { expectedCloseDate: "2026-02-30" },
    { extra: 1 },
  ])("rejects %j", (body) => {
    expect(updateDealSchema.safeParse(body).success).toBe(false);
  });
});

describe("listDealsQuerySchema", () => {
  it("applies pagination defaults and ignores unknown keys", () => {
    const result = listDealsQuerySchema.safeParse({ foo: "bar" });

    expect(result.data).toEqual({ page: 1, pageSize: 20 });
  });

  it("accepts a valid stage and companyId", () => {
    const result = listDealsQuerySchema.safeParse({ stage: "WON", companyId: validCompanyId });

    expect(result.data).toMatchObject({ stage: "WON", companyId: validCompanyId });
  });

  it.each([
    ["an invalid stage", { stage: "won" }],
    ["an empty stage", { stage: "" }],
    ["a repeated stage key", { stage: ["WON", "LOST"] }],
    ["an invalid companyId", { companyId: "not-a-uuid" }],
    ["an empty companyId", { companyId: "" }],
    ["a page size over 100", { pageSize: "101" }],
  ])("rejects %s", (_name, query) => {
    expect(listDealsQuerySchema.safeParse(query).success).toBe(false);
  });
});
