import { describe, expect, it } from "vitest";
import { factorLabel, formatPoints, isOverdue, stageBadgeVariant } from "@/lib/deal-display";
import type { DealStage, PriorityFactor } from "@/lib/types";

describe("deal display helpers", () => {
  it.each<[string, string]>([
    ["daysSinceContact", "Days since last contact"],
    ["closeDate", "Close date approaching"],
    ["closeDatePassed", "Close date passed"],
    ["stage", "Stage"],
    ["value", "Deal value"],
    ["AI adjustment from interaction notes", "AI adjustment from interaction notes"],
    ["somethingNew", "somethingNew"],
    ["toString", "toString"],
  ])("labels factor %s as %s", (name, label) => {
    expect(factorLabel(name)).toBe(label);
  });

  it.each<[number, string]>([
    [20, "+20"],
    [-5, "-5"],
    [0, "0"],
  ])("formats %i points as %s", (points, text) => {
    expect(formatPoints(points)).toBe(text);
  });

  it.each<[DealStage, string]>([
    ["LEAD", "neutral"],
    ["QUALIFIED", "neutral"],
    ["PROPOSAL", "neutral"],
    ["NEGOTIATION", "neutral"],
    ["WON", "success"],
    ["LOST", "danger"],
  ])("gives stage %s the %s badge variant", (stage, variant) => {
    expect(stageBadgeVariant(stage)).toBe(variant);
  });

  it.each<[string, boolean, PriorityFactor[]]>([
    ["a closeDatePassed factor", true, [{ name: "closeDatePassed", points: 25 }]],
    ["only a closeDate factor", false, [{ name: "closeDate", points: 20 }]],
    ["no factors", false, []],
  ])("with %s, isOverdue is %s", (_name, overdue, factors) => {
    expect(isOverdue(factors)).toBe(overdue);
  });
});
