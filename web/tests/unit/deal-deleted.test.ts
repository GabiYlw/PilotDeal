import { describe, expect, it } from "vitest";
import { dealDeletedMessage, dealDeletedUrl } from "@/lib/deal-deleted";

describe("dealDeletedMessage", () => {
  it.each<[string | string[] | undefined, string | null]>([
    ["1", "Deal deleted."],
    ["already", "This deal was already deleted."],
    [undefined, null],
    ["", null],
    ["0", null],
    ["yes", null],
    [["1", "1"], null],
  ])("maps %j to %j", (value, expected) => {
    expect(dealDeletedMessage(value)).toBe(expected);
  });
});

describe("dealDeletedUrl", () => {
  it.each([
    ["deleted", "/deals?deleted=1"],
    ["already", "/deals?deleted=already"],
  ] as const)("builds the URL for %s", (outcome, url) => {
    expect(dealDeletedUrl(outcome)).toBe(url);
  });
});
