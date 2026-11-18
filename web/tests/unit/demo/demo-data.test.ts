// @vitest-environment node
import { describe, expect, it } from "vitest";
import { companyPageIds, dealPageIds, NEW_COMPANY_IDS, NEW_DEAL_IDS } from "@/demo/ids";
import * as mutations from "@/demo/mutations";
import {
  companyContacts,
  dealInteractions,
  findDeal,
  nextAction,
  prioritizedDeals,
} from "@/demo/queries";
import { type DemoState, initialState } from "@/demo/state";
import { DEMO_LIMIT, DemoApiError, VALIDATION_ERROR } from "@/demo/validation";

const NOW = new Date("2026-11-18T12:00:00.000Z");
const ALL = { page: 1, pageSize: 100 };

function fresh(): DemoState {
  return initialState(NOW);
}

function ranking(state: DemoState): string[] {
  return prioritizedDeals(state, ALL, NOW).data.map((item) => item.deal.id);
}

function thrown(run: () => unknown): DemoApiError {
  try {
    run();
  } catch (error) {
    if (error instanceof DemoApiError) return error;
    throw error;
  }
  throw new Error("expected a DemoApiError");
}

describe("initialState", () => {
  it("resolves the seed's relative dates against the given day", () => {
    const state = fresh();
    // Seeded as expectedCloseInDays: -6, so overdue on any day the demo is opened.
    expect(findDeal(state, "warehouse-route-optimization-platform")?.expectedCloseDate).toBe(
      "2026-11-12",
    );
    const [latest] = dealInteractions(state, "warehouse-route-optimization-platform");
    expect(latest?.occurredAt).toBe("2026-11-16T12:00:00.000Z");
  });
});

describe("prioritizedDeals", () => {
  it("ranks the open deals with the API's rules and order", () => {
    const { data, meta } = prioritizedDeals(fresh(), ALL, NOW);

    expect(meta.total).toBe(6);
    expect(data[0]?.deal.id).toBe("project-management-suite-for-three-offices");
    expect(data[0]?.priority).toMatchObject({ score: 80, scoredBy: "rules" });
    // Equal scores: earlier close date first, a deal without a date last.
    expect(data.map((item) => item.priority.score)).toEqual([80, 65, 65, 65, 45, 45]);
    expect(data.at(-1)?.deal.id).toBe("driver-mobile-app-pilot");
  });

  it("re-scores and re-ranks a deal as soon as its stage changes", () => {
    const { state } = mutations.updateDeal(
      fresh(),
      "driver-mobile-app-pilot",
      { stage: "NEGOTIATION" },
      NOW,
    );

    const driver = prioritizedDeals(state, ALL, NOW).data.find(
      (item) => item.deal.id === "driver-mobile-app-pilot",
    );
    expect(driver?.priority.score).toBe(65);
    expect(driver?.priority.reason).toContain("negotiation stage");
    expect(ranking(state).indexOf("driver-mobile-app-pilot")).toBe(4);
  });

  it("leaves a won deal out of the ranking and gives it no next action", () => {
    const { state } = mutations.updateDeal(
      fresh(),
      "driver-mobile-app-pilot",
      { stage: "WON" },
      NOW,
    );
    const deal = findDeal(state, "driver-mobile-app-pilot");

    expect(ranking(state)).not.toContain("driver-mobile-app-pilot");
    expect(deal?.closedAt).toBe(NOW.toISOString());
    expect(deal && nextAction(state, deal, NOW)).toBeNull();
  });
});

describe("validation", () => {
  it.each([
    [
      "an empty title",
      () => mutations.updateDeal(fresh(), "driver-mobile-app-pilot", { title: " " }, NOW),
      "title",
      "Title is required",
    ],
    [
      "a negative value",
      () => mutations.updateDeal(fresh(), "driver-mobile-app-pilot", { value: -1 }, NOW),
      "value",
      "Value must be 0 or more",
    ],
    [
      "a value with three decimals",
      () => mutations.updateDeal(fresh(), "driver-mobile-app-pilot", { value: 1.234 }, NOW),
      "value",
      "Use at most 2 decimal places",
    ],
    [
      "an impossible close date",
      () =>
        mutations.updateDeal(
          fresh(),
          "driver-mobile-app-pilot",
          { expectedCloseDate: "2026-02-30" },
          NOW,
        ),
      "expectedCloseDate",
      "Enter a valid date (YYYY-MM-DD)",
    ],
    [
      "a website without http",
      () =>
        mutations.createCompany(fresh(), { name: "Acme", industry: null, website: "acme" }, NOW),
      "website",
      "Enter a valid URL starting with http:// or https://",
    ],
    [
      "an interaction in the future",
      () =>
        mutations.createInteraction(
          fresh(),
          "driver-mobile-app-pilot",
          { type: "CALL", notes: "Call", occurredAt: "2026-12-01T00:00:00.000Z" },
          NOW,
        ),
      "occurredAt",
      "Date cannot be in the future",
    ],
  ])("rejects %s with the API's message", (_case, run, field, message) => {
    const error = thrown(run);

    expect(error).toMatchObject({ status: 400, code: VALIDATION_ERROR });
    expect(error.details).toEqual([{ path: [field], message }]);
  });

  it("answers 404 for a deal that does not exist", () => {
    expect(thrown(() => mutations.deleteDeal(fresh(), "no-such-deal")).status).toBe(404);
  });
});

describe("deleteCompany", () => {
  it("removes the client's contacts, deals and interactions and remembers the ids", () => {
    const { state } = mutations.deleteCompany(fresh(), "northwind-logistics");

    expect(companyContacts(state, "northwind-logistics")).toEqual([]);
    expect(findDeal(state, "warehouse-route-optimization-platform")).toBeUndefined();
    expect(dealInteractions(state, "warehouse-route-optimization-platform")).toEqual([]);
    expect([...state.deletedIds]).toEqual([
      "northwind-logistics",
      "warehouse-route-optimization-platform",
      "driver-mobile-app-pilot",
    ]);
  });
});

describe("new ids", () => {
  it("gives new clients and deals the pre-built pages in order", () => {
    const first = mutations.createCompany(
      fresh(),
      { name: "Acme", industry: null, website: null },
      NOW,
    );
    const deal = mutations.createDeal(
      first.state,
      first.result.id,
      { title: "Pilot", value: 1000, stage: "LEAD" },
      NOW,
    );

    expect(first.result.id).toBe(NEW_COMPANY_IDS[0]);
    expect(deal.result.id).toBe(NEW_DEAL_IDS[0]);
    expect(companyPageIds()).toContainEqual({ id: first.result.id });
    expect(dealPageIds()).toContainEqual({ id: deal.result.id });
  });

  it("refuses a new client once every pre-built page is taken", () => {
    let state = fresh();
    for (let created = 0; created < NEW_COMPANY_IDS.length; created += 1) {
      state = mutations.createCompany(
        state,
        { name: "Acme", industry: null, website: null },
        NOW,
      ).state;
    }

    const error = thrown(() =>
      mutations.createCompany(state, { name: "One more", industry: null, website: null }, NOW),
    );
    expect(error.code).toBe(DEMO_LIMIT);
  });
});
