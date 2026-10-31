import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api";
import { toFormErrors } from "@/lib/form-state";
import { API_NOT_RUNNING_MESSAGE } from "@/lib/messages";

const FIELDS = ["type", "notes", "occurredAt"] as const;

describe("toFormErrors", () => {
  it("keeps only the first message per field", () => {
    const error = new ApiError("Invalid request body", 400, "VALIDATION_ERROR", [
      { path: ["notes"], message: "first" },
      { path: ["notes"], message: "second" },
    ]);

    expect(toFormErrors(error, FIELDS)).toEqual({
      fieldErrors: { notes: "first" },
      formError: undefined,
    });
  });

  it.each<[string, unknown]>([
    ["an empty path", [{ path: [], message: "bad body" }]],
    ["an unknown field", [{ path: ["extra"], message: "bad body" }]],
  ])("puts %s into the form error", (_name, details) => {
    const error = new ApiError("Invalid request body", 400, "VALIDATION_ERROR", details);

    expect(toFormErrors(error, FIELDS)).toEqual({ fieldErrors: {}, formError: "bad body" });
  });

  it.each<[string, unknown]>([
    ["undefined", undefined],
    ["a string", "oops"],
    ["an empty array", []],
    ["malformed issues", [{ nope: 1 }]],
  ])("uses the error message when details are %s", (_name, details) => {
    const error = new ApiError("Invalid request body", 400, "VALIDATION_ERROR", details);

    expect(toFormErrors(error, FIELDS)).toEqual({
      fieldErrors: {},
      formError: "Invalid request body",
    });
  });

  it("uses the given not-found and failure messages", () => {
    const messages = { notFound: "X", failed: "Y" };

    expect(toFormErrors(new ApiError("m", 404, "X"), FIELDS, messages).formError).toBe("X");
    expect(toFormErrors(new ApiError("m", 500, "X"), FIELDS, messages).formError).toBe("Y");
  });

  it.each<[number, string]>([
    [0, API_NOT_RUNNING_MESSAGE],
    [404, "This deal no longer exists."],
    [500, "Could not save. Please try again."],
    [409, "Could not save. Please try again."],
  ])("maps status %i to its message", (status, message) => {
    expect(toFormErrors(new ApiError("m", status, "X"), FIELDS)).toEqual({
      fieldErrors: {},
      formError: message,
    });
  });
});
