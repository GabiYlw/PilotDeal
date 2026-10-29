import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenDealStage } from "../../src/modules/deals/deals.schemas.js";
import type { DealContext, PriorityFactorName } from "../../src/scoring/priority-scorer.js";
import { RuleBasedScorer } from "../../src/scoring/rule-based-scorer.js";
import type { Clock } from "../../src/shared/clock.js";

const DAY = 86_400_000;
const NOW = new Date("2026-03-15T12:00:00.000Z");
const clock: Clock = { now: () => NOW };
const scorer = new RuleBasedScorer(clock);

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * DAY);
}

function isoDaysFromToday(n: number): string {
  return new Date(Date.UTC(2026, 2, 15 + n)).toISOString().slice(0, 10);
}

interface ContextOverrides {
  stage?: OpenDealStage;
  value?: number;
  expectedCloseDate?: string | null;
  createdAt?: Date;
  interactionDates?: Date[];
}

function context(overrides: ContextOverrides = {}): DealContext {
  const interactionDates = overrides.interactionDates ?? [];
  return {
    deal: {
      id: "deal-1",
      title: "Deal",
      value: overrides.value ?? 100,
      stage: overrides.stage ?? "LEAD",
      expectedCloseDate: overrides.expectedCloseDate ?? null,
      createdAt: overrides.createdAt ?? NOW,
    },
    companyName: "Acme",
    interactionCount: interactionDates.length,
    recentInteractions: interactionDates.map((occurredAt) => ({
      type: "NOTE" as const,
      notes: "n",
      occurredAt,
    })),
  };
}

async function pointsOf(ctx: DealContext, name: PriorityFactorName): Promise<number> {
  const result = await scorer.score(ctx);
  return result.factors.find((factor) => factor.name === name)?.points ?? 0;
}

describe("RuleBasedScorer", () => {
  describe("stage points", () => {
    it.each<[OpenDealStage, number]>([
      ["LEAD", 5],
      ["QUALIFIED", 10],
      ["PROPOSAL", 20],
      ["NEGOTIATION", 25],
    ])("gives stage %s %i points", async (stage, expected) => {
      expect(await pointsOf(context({ stage }), "stage")).toBe(expected);
    });
  });

  describe("days since contact", () => {
    it.each([
      [3, 0],
      [4, 10],
      [7, 10],
      [8, 20],
      [14, 20],
      [15, 25],
      [21, 25],
      [22, 30],
    ])("gives %i days since the last interaction %i points", async (days, expected) => {
      const ctx = context({ interactionDates: [daysAgo(days)] });
      expect(await pointsOf(ctx, "daysSinceContact")).toBe(expected);
    });

    it.each([
      [10, 20],
      [0, 0],
    ])("measures from createdAt %i days ago when there are no interactions (%i points)", async (days, expected) => {
      const ctx = context({ createdAt: daysAgo(days) });
      expect(await pointsOf(ctx, "daysSinceContact")).toBe(expected);
    });

    it("uses the latest occurredAt even when the interactions are not sorted", async () => {
      const ctx = context({ interactionDates: [daysAgo(10), daysAgo(2)] });
      expect(await pointsOf(ctx, "daysSinceContact")).toBe(0);
    });

    it("ignores createdAt when an interaction exists", async () => {
      const ctx = context({ createdAt: daysAgo(30), interactionDates: [daysAgo(1)] });
      expect(await pointsOf(ctx, "daysSinceContact")).toBe(0);
    });

    it.each([
      ["a future interaction", { interactionDates: [new Date(NOW.getTime() + 5 * DAY)] }],
      ["a future createdAt", { createdAt: new Date(NOW.getTime() + 5 * DAY) }],
    ])("gives 0 points and does not throw for %s", async (_label, overrides) => {
      const result = await scorer.score(context(overrides));
      expect(result.factors.find((f) => f.name === "daysSinceContact")).toBeUndefined();    });

    it("counts calendar days, not elapsed 24-hour periods", async () => {
      const lateClock: Clock = { now: () => new Date("2026-03-15T00:01:00.000Z") };
      const result = await new RuleBasedScorer(lateClock).score(
        context({ interactionDates: [new Date("2026-03-11T23:59:00.000Z")] }),
      );
      expect(result.factors).toContainEqual({ name: "daysSinceContact", points: 10 });
    });
  });

  describe("close date", () => {
    it.each([
      [-1, 25],
      [0, 20],
      [7, 20],
      [8, 10],
      [30, 10],
      [31, 0],
    ])("gives a close date %i days from today %i points", async (offset, expected) => {
      const ctx = context({ expectedCloseDate: isoDaysFromToday(offset) });
      expect(await pointsOf(ctx, "closeDate")).toBe(expected);
    });

    it("gives 0 points and no factor when there is no close date", async () => {
      const result = await scorer.score(context({ expectedCloseDate: null }));
      expect(result.factors.map((f) => f.name)).not.toContain("closeDate");
    });

    it("gives 25 points and a large n for a very old close date", async () => {
      const result = await scorer.score(context({ expectedCloseDate: "1900-01-01" }));
      expect(result.factors).toContainEqual({ name: "closeDate", points: 25 });
      expect(result.nextAction).toBe("Confirm a new close date or push for a decision with Acme.");
    });
  });

  describe("value points", () => {
    it.each([
      [0, 5],
      [4999.99, 5],
      [5000, 10],
      [19_999.99, 10],
      [20_000, 15],
      [49_999.99, 15],
      [50_000, 20],
    ])("gives a value of %f %i points", async (value, expected) => {
      expect(await pointsOf(context({ value }), "value")).toBe(expected);
    });
  });

  describe("score and factors", () => {
    it("scores 10 for the minimum case", async () => {
      const result = await scorer.score(context({ stage: "LEAD", value: 0 }));
      expect(result.score).toBe(10);
    });

    it("scores 100 for the maximum case", async () => {
      const result = await scorer.score(
        context({
          stage: "NEGOTIATION",
          value: 50_000,
          expectedCloseDate: isoDaysFromToday(-1),
          interactionDates: [daysAgo(22)],
        }),
      );
      expect(result.score).toBe(100);
    });

    it("equals the sum of the factor points", async () => {
      const result = await scorer.score(
        context({
          stage: "PROPOSAL",
          value: 25_000,
          expectedCloseDate: isoDaysFromToday(5),
          interactionDates: [daysAgo(9)],
        }),
      );
      // contact 20 + close 20 + stage 20 + value 15
      expect(result.score).toBe(75);
      expect(result.score).toBe(result.factors.reduce((sum, f) => sum + f.points, 0));
    });

    it("lists factors in the fixed order with exact names and scoredBy rules", async () => {
      const result = await scorer.score(
        context({
          stage: "QUALIFIED",
          value: 6000,
          expectedCloseDate: isoDaysFromToday(10),
          interactionDates: [daysAgo(5)],
        }),
      );
      expect(result.factors).toEqual([
        { name: "daysSinceContact", points: 10 },
        { name: "closeDate", points: 10 },
        { name: "stage", points: 10 },
        { name: "value", points: 10 },
      ]);
      expect(result.scoredBy).toBe("rules");
    });

    it("omits rules with 0 points and keeps stage and value", async () => {
      const result = await scorer.score(context());
      expect(result.factors).toEqual([
        { name: "stage", points: 5 },
        { name: "value", points: 5 },
      ]);
    });
  });

  describe("reason", () => {
    it("names the two highest factors in the template sentence", async () => {
      const result = await scorer.score(
        context({
          createdAt: daysAgo(23),
          expectedCloseDate: isoDaysFromToday(-6),
        }),
      );
      expect(result.reason).toBe(
        "No contact for 23 days and the expected close date passed 6 days ago.",
      );
    });

    it("puts the days since contact phrase first on a tie with the close date", async () => {
      const result = await scorer.score(
        context({
          interactionDates: [daysAgo(15)],
          expectedCloseDate: isoDaysFromToday(-3),
        }),
      );
      expect(result.reason).toBe(
        "No contact for 15 days and the expected close date passed 3 days ago.",
      );
    });

    it("puts the close date phrase before the stage on a tie", async () => {
      const result = await scorer.score(
        context({ stage: "NEGOTIATION", expectedCloseDate: isoDaysFromToday(-1) }),
      );
      expect(result.reason).toBe(
        "The expected close date passed 1 days ago and the deal is in the negotiation stage.",
      );
    });

    it("puts the stage phrase before the value on a tie", async () => {
      const result = await scorer.score(context({ stage: "PROPOSAL", value: 50_000 }));
      expect(result.reason).toBe("The deal is in the proposal stage and the deal is worth 50,000.");
    });

    it("uses the 'is in n days' phrase for a future close date", async () => {
      const result = await scorer.score(
        context({ stage: "NEGOTIATION", expectedCloseDate: isoDaysFromToday(5) }),
      );
      expect(result.reason).toBe(
        "The deal is in the negotiation stage and the expected close date is in 5 days.",
      );
    });

    it("uses 'is in 0 days' and not 'passed' when the close date is today", async () => {
      const result = await scorer.score(
        context({ stage: "NEGOTIATION", expectedCloseDate: isoDaysFromToday(0) }),
      );
      expect(result.reason).toBe(
        "The deal is in the negotiation stage and the expected close date is in 0 days.",
      );
    });

    it("uses stage then value for a deal with only those two factors and value 0", async () => {
      const result = await scorer.score(context({ stage: "LEAD", value: 0 }));
      expect(result.reason).toBe("The deal is in the lead stage and the deal is worth 0.");
    });

    it.each([
      [48_500.5, "48,500.50"],
      [50_000, "50,000"],
      [1_234_567.89, "1,234,567.89"],
      [100, "100"],
      [4999.99, "4,999.99"],
    ])("formats the value %f as %s in the reason", async (value, formatted) => {
      const result = await scorer.score(context({ stage: "LEAD", value }));
      expect(result.reason.toLowerCase()).toContain(`the deal is worth ${formatted}`);
    });
  });

  describe("nextAction", () => {
    it("asks for a new close date when the close date has passed", async () => {
      const result = await scorer.score(context({ expectedCloseDate: isoDaysFromToday(-1) }));
      expect(result.nextAction).toBe("Confirm a new close date or push for a decision with Acme.");
    });

    it("prefers the close date rule over the contact rule", async () => {
      const result = await scorer.score(
        context({ expectedCloseDate: isoDaysFromToday(-1), interactionDates: [daysAgo(30)] }),
      );
      expect(result.nextAction).toBe("Confirm a new close date or push for a decision with Acme.");
    });

    it("does not treat a close date today as passed", async () => {
      const result = await scorer.score(
        context({ expectedCloseDate: isoDaysFromToday(0), stage: "QUALIFIED" }),
      );
      expect(result.nextAction).toBe("Prepare and send a proposal.");
    });

    it("does not treat a null close date as passed", async () => {
      const result = await scorer.score(context({ expectedCloseDate: null }));
      expect(result.nextAction).toBe("Schedule a discovery call to qualify the lead.");
    });

    it("suggests a follow up at 15 days without contact", async () => {
      const result = await scorer.score(context({ interactionDates: [daysAgo(15)] }));
      expect(result.nextAction).toBe("Follow up with Acme: no contact for 15 days.");
    });

    it("prefers the contact rule over the stage text at 30 days", async () => {
      const result = await scorer.score(
        context({ stage: "NEGOTIATION", interactionDates: [daysAgo(30)] }),
      );
      expect(result.nextAction).toBe("Follow up with Acme: no contact for 30 days.");
    });

    it("falls back to the stage text at 14 days without contact", async () => {
      const result = await scorer.score(context({ interactionDates: [daysAgo(14)] }));
      expect(result.nextAction).toBe("Schedule a discovery call to qualify the lead.");
    });

    it.each<[OpenDealStage, string]>([
      ["LEAD", "Schedule a discovery call to qualify the lead."],
      ["QUALIFIED", "Prepare and send a proposal."],
      ["PROPOSAL", "Follow up on the proposal and address open questions."],
      ["NEGOTIATION", "Agree on final terms and close the deal."],
    ])("uses the stage text for %s", async (stage, expected) => {
      const result = await scorer.score(context({ stage }));
      expect(result.nextAction).toBe(expected);
    });
  });

  describe("clock", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2030-01-01T00:00:00.000Z"));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("uses clock.now() and not the system time", async () => {
      const result = await scorer.score(context({ interactionDates: [daysAgo(8)] }));
      expect(result.factors).toContainEqual({ name: "daysSinceContact", points: 20 });
    });

    it("reads clock.now() exactly once per score call", async () => {
      const now = vi.fn(() => NOW);
      await new RuleBasedScorer({ now }).score(context());
      expect(now).toHaveBeenCalledTimes(1);
    });
  });
});
