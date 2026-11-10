import { describe, expect, it } from "vitest";
import { companyDeletedMessage, companyDeletedUrl } from "@/lib/company-deleted";

describe("companyDeletedUrl", () => {
  it.each([
    ["deleted", "/clients?deleted=1"],
    ["already", "/clients?deleted=already"],
  ] as const)("builds the url for %s", (outcome, url) => {
    expect(companyDeletedUrl(outcome)).toBe(url);
  });
});

describe("companyDeletedMessage", () => {
  it.each<[string | string[] | undefined, string | null]>([
    ["1", "Client deleted."],
    ["already", "This client was already deleted."],
    ["yes", null],
    [undefined, null],
    [["1", "1"], null],
  ])("maps %j to %j", (value, message) => {
    expect(companyDeletedMessage(value)).toBe(message);
  });
});
