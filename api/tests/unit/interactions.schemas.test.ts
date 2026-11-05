import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createInteractionSchema,
  updateInteractionSchema,
} from "../../src/modules/interactions/interactions.schemas.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("createInteractionSchema", () => {
  it("trims notes and leaves occurredAt undefined when omitted", () => {
    const result = createInteractionSchema.safeParse({ type: "CALL", notes: "  Pricing  " });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ type: "CALL", notes: "Pricing" });
  });

  it("accepts notes of exactly 5000 characters, also with surrounding spaces", () => {
    const notes = "a".repeat(5000);

    expect(createInteractionSchema.safeParse({ type: "NOTE", notes }).success).toBe(true);
    expect(createInteractionSchema.safeParse({ type: "NOTE", notes: ` ${notes} ` }).success).toBe(
      true,
    );
  });

  it("rejects notes of 5001 characters", () => {
    const notes = "a".repeat(5001);

    expect(createInteractionSchema.safeParse({ type: "NOTE", notes }).success).toBe(false);
  });

  it.each([
    ["a missing type", { notes: "x" }],
    ["an unknown type", { type: "SMS", notes: "x" }],
    ["a lowercase type", { type: "call", notes: "x" }],
    ["missing notes", { type: "CALL" }],
    ["empty notes", { type: "CALL", notes: "" }],
    ["whitespace notes", { type: "CALL", notes: "   " }],
    ["a date-only occurredAt", { type: "CALL", notes: "x", occurredAt: "2026-01-15" }],
    [
      "an occurredAt without offset",
      { type: "CALL", notes: "x", occurredAt: "2026-01-15T10:30:00" },
    ],
    ["a non-date occurredAt", { type: "CALL", notes: "x", occurredAt: "not-a-date" }],
    ["a null occurredAt", { type: "CALL", notes: "x", occurredAt: null }],
    ["an occurredAt before 1900", { type: "CALL", notes: "x", occurredAt: "1899-12-31T23:59:59Z" }],
    ["a dealId", { type: "CALL", notes: "x", dealId: "22222222-2222-4222-8222-222222222222" }],
    ["an unknown key", { type: "CALL", notes: "x", extra: 1 }],
  ])("rejects %s", (_name, body) => {
    expect(createInteractionSchema.safeParse(body).success).toBe(false);
  });

  it("normalizes a numeric offset to the same instant", () => {
    const result = createInteractionSchema.safeParse({
      type: "CALL",
      notes: "x",
      occurredAt: "2026-01-15T12:30:00+02:00",
    });

    expect(result.data?.occurredAt?.toISOString()).toBe("2026-01-15T10:30:00.000Z");
  });

  it("rejects an occurredAt one hour in the future", () => {
    const future = new Date(Date.now() + 3_600_000).toISOString();

    expect(
      createInteractionSchema.safeParse({ type: "CALL", notes: "x", occurredAt: future }).success,
    ).toBe(false);
  });

  it("accepts an occurredAt equal to now", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

    const result = createInteractionSchema.safeParse({
      type: "CALL",
      notes: "x",
      occurredAt: "2026-06-15T12:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });
});

describe("updateInteractionSchema", () => {
  it("rejects an empty object", () => {
    expect(updateInteractionSchema.safeParse({}).success).toBe(false);
  });

  it("accepts a single field", () => {
    expect(updateInteractionSchema.safeParse({ type: "MEETING" }).success).toBe(true);
  });

  it.each([{ notes: "" }, { notes: null }, { type: "SMS" }, { occurredAt: null }, { extra: 1 }])(
    "rejects %j",
    (body) => {
      expect(updateInteractionSchema.safeParse(body).success).toBe(false);
    },
  );
});
