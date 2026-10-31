import { describe, expect, it } from "vitest";
import { nullableText, text, toDealValue } from "@/lib/form-data";

describe("nullableText", () => {
  it.each([
    ["", null],
    ["   ", null],
    ["Acme", "Acme"],
    [" Acme ", " Acme "],
  ])("turns %j into %j", (input, expected) => {
    expect(nullableText(input)).toBe(expected);
  });
});

describe("toDealValue", () => {
  it.each<[string, number | string | undefined]>([
    ["", undefined],
    ["   ", undefined],
    ["1500.50", 1500.5],
    ["0", 0],
    ["abc", "abc"],
    ["Infinity", "Infinity"],
  ])("turns %j into %j", (input, expected) => {
    expect(toDealValue(input)).toBe(expected);
  });
});

describe("text", () => {
  it("returns an empty string for a missing field", () => {
    expect(text(new FormData(), "name")).toBe("");
  });

  it("returns the submitted string", () => {
    const data = new FormData();
    data.set("name", "Acme");

    expect(text(data, "name")).toBe("Acme");
  });
});
