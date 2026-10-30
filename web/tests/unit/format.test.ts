import { afterAll, describe, expect, it, vi } from "vitest";
import { formatDate, formatValue } from "@/lib/format";

// Pin a zone far from UTC (UTC+14) so the formatDate tests fail if it stops forcing UTC, even
// on a machine that runs in UTC. format.ts builds its formatter at import time, so the zone is
// set in vi.hoisted, which runs before the imports.
const originalTimeZone = vi.hoisted(() => {
  const previous = process.env.TZ;
  process.env.TZ = "Pacific/Kiritimati";
  return previous;
});

afterAll(() => {
  if (originalTimeZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalTimeZone;
});

describe("formatValue", () => {
  it.each([
    [60000, "60,000"],
    [1234.5, "1,234.50"],
    [0, "0"],
    [9999999999.99, "9,999,999,999.99"],
  ])("formats %s as %s", (value, expected) => {
    expect(formatValue(value)).toBe(expected);
  });
});

describe("formatDate", () => {
  it("runs in a zone where the local day differs from the UTC day", () => {
    expect(new Date("2026-10-22T23:30:00.000Z").getDate()).toBe(23);
  });

  it.each([
    ["a date without time", "2026-10-22", "Oct 22, 2026"],
    ["a late-evening UTC timestamp", "2026-10-22T23:30:00.000Z", "Oct 22, 2026"],
    ["an early-morning UTC timestamp", "2026-10-22T00:30:00.000Z", "Oct 22, 2026"],
  ])("formats %s as its UTC day", (_name, value, expected) => {
    expect(formatDate(value)).toBe(expected);
  });
});
