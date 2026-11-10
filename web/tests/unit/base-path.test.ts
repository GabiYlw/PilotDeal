import { describe, expect, it } from "vitest";
import { readBasePath } from "@/lib/base-path";

describe("readBasePath", () => {
  it.each([
    [undefined, ""],
    ["", ""],
    ["/demo", "/demo"],
    ["/apps/demo", "/apps/demo"],
  ])("reads %j as %j", (value, expected) => {
    expect(readBasePath(value)).toBe(expected);
  });

  it.each(["demo", "/demo/", "/", "/de mo", "//demo"])("rejects %j", (value) => {
    expect(() => readBasePath(value)).toThrow(/BASE_PATH must start with "\/"/);
  });
});
