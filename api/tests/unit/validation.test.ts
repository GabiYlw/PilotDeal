import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ValidationError } from "../../src/shared/errors.js";
import { paginationQuerySchema, toSkipTake } from "../../src/shared/pagination.js";
import { parseOrThrow } from "../../src/shared/validation.js";

describe("paginationQuerySchema", () => {
  it("applies defaults when page and pageSize are missing", () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("parses decimal integer strings", () => {
    expect(paginationQuerySchema.parse({ page: "3", pageSize: "100" })).toEqual({
      page: 3,
      pageSize: 100,
    });
  });

  it("ignores unknown query parameters", () => {
    expect(paginationQuerySchema.parse({ sort: "name" })).toEqual({ page: 1, pageSize: 20 });
  });

  it.each(["0", "-1", "1.5", "abc", "", "1000001"])("rejects page=%j", (page) => {
    expect(paginationQuerySchema.safeParse({ page }).success).toBe(false);
  });

  it.each(["0", "101", "1.5", "abc", ""])("rejects pageSize=%j", (pageSize) => {
    expect(paginationQuerySchema.safeParse({ pageSize }).success).toBe(false);
  });

  it("rejects repeated keys (arrays)", () => {
    expect(paginationQuerySchema.safeParse({ page: ["1", "2"] }).success).toBe(false);
  });
});

describe("toSkipTake", () => {
  it("computes skip and take from page and pageSize", () => {
    expect(toSkipTake({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 });
  });
});

describe("parseOrThrow", () => {
  it("returns the parsed value on success", () => {
    expect(parseOrThrow(z.object({ a: z.string() }), { a: "x" }, "bad")).toEqual({ a: "x" });
  });

  it("throws a ValidationError with path and message details", () => {
    const schema = z.object({ a: z.string() });

    try {
      parseOrThrow(schema, { a: 1 }, "Invalid request body");
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const validationError = error as ValidationError;
      expect(validationError.message).toBe("Invalid request body");
      const details = validationError.details as { path: unknown[]; message: string }[];
      expect(details.map((detail) => detail.path)).toEqual([["a"]]);
      expect(typeof details[0]?.message).toBe("string");
    }
  });
});
