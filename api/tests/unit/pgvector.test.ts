import { describe, expect, it } from "vitest";
import { toVectorLiteral } from "../../src/shared/pgvector.js";

describe("toVectorLiteral", () => {
  it.each([
    [[0.5, -1, 0], "[0.5,-1,0]"],
    [[3e-7], "[3e-7]"],
    [[], "[]"],
  ])("formats %j as %s", (vector, expected) => {
    expect(toVectorLiteral(vector)).toBe(expected);
  });

  it.each([
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
  ])("throws for %s", (_name, value) => {
    expect(() => toVectorLiteral([0, value])).toThrow("Vector contains a non-finite value");
  });
});
