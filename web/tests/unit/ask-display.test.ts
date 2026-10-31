import { describe, expect, it } from "vitest";
import { askHref, parseAskParams, relevanceLevel } from "@/lib/ask-display";

describe("parseAskParams", () => {
  it.each<[string, Record<string, string | string[] | undefined>, unknown]>([
    ["nothing", {}, { question: null, dealId: null }],
    ["an empty question", { q: "" }, { question: "", dealId: null }],
    ["an untrimmed question", { q: "  hi " }, { question: "  hi ", dealId: null }],
    ["repeated params", { q: ["a", "b"], dealId: ["x", "y"] }, { question: "a", dealId: "x" }],
    ["an empty dealId", { q: "abc", dealId: "" }, { question: "abc", dealId: null }],
  ])("reads %s", (_name, params, expected) => {
    expect(parseAskParams(params)).toEqual(expected);
  });
});

describe("askHref", () => {
  it.each<[string, { question?: string | null; dealId?: string | null }, string]>([
    ["no params", {}, "/ask"],
    ["null params", { question: null, dealId: null }, "/ask"],
    ["a question", { question: "hi there" }, "/ask?q=hi+there"],
    ["a deal", { dealId: "d1" }, "/ask?dealId=d1"],
    ["both", { question: "hi", dealId: "d1" }, "/ask?q=hi&dealId=d1"],
    ["an empty question", { question: "" }, "/ask?q="],
    ["special characters", { question: "a&b #c?" }, "/ask?q=a%26b+%23c%3F"],
  ])("builds the link for %s", (_name, input, expected) => {
    expect(askHref(input)).toBe(expected);
  });
});

describe("relevanceLevel", () => {
  it.each([
    [0.75, "high"],
    [0.6, "high"],
    [0.59, "medium"],
    [0.4, "medium"],
    [0.39, "low"],
    [0.25, "low"],
  ])("maps similarity %s to %s", (similarity, level) => {
    expect(relevanceLevel(similarity)).toBe(level);
  });
});
