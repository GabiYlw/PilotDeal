import { describe, expect, it } from "vitest";
import { companyDeletedMessage, companyDeletedUrl } from "@/lib/company-deleted";

describe("companyDeletedUrl", () => {
  it.each([
    ["deleted", "/companies?deleted=1"],
    ["already", "/companies?deleted=already"],
  ] as const)("builds the url for %s", (outcome, url) => {
    expect(companyDeletedUrl(outcome)).toBe(url);
  });
});

describe("companyDeletedMessage", () => {
  it.each<[string | string[] | undefined, string | null]>([
    ["1", "Company deleted."],
    ["already", "This company was already deleted."],
    ["yes", null],
    [undefined, null],
    [["1", "1"], null],
  ])("maps %j to %j", (value, message) => {
    expect(companyDeletedMessage(value)).toBe(message);
  });
});
