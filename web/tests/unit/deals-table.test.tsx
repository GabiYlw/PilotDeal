import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DealsTable } from "@/components/deals/deals-table";
import type { PriorityFactor, PrioritizedDeal } from "@/lib/types";

interface ItemOptions {
  id?: string;
  title?: string;
  value?: number;
  expectedCloseDate?: string | null;
  score?: number;
  factors?: PriorityFactor[];
}

function item(options: ItemOptions = {}): PrioritizedDeal {
  return {
    deal: {
      id: options.id ?? "d1",
      companyId: "c1",
      companyName: "Acme",
      title: options.title ?? "Big deal",
      value: options.value ?? 1000,
      stage: "PROPOSAL",
      expectedCloseDate:
        options.expectedCloseDate === undefined ? "2026-10-22" : options.expectedCloseDate,
      closedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    priority: {
      score: options.score ?? 50,
      reason: "Some reason.",
      nextAction: "Do it.",
      factors: options.factors ?? [],
      scoredBy: "rules",
    },
  };
}

const META = { page: 1, pageSize: 20, total: 1 };

describe("DealsTable", () => {
  it("shows Overdue for a row whose factors include closeDatePassed", () => {
    const overdue = item({ factors: [{ name: "closeDatePassed", points: 25 }] });
    render(<DealsTable items={[overdue]} meta={META} />);

    expect(screen.getByText("Overdue")).toBeTruthy();
  });

  it("does not show Overdue for a past date when the API sent no closeDatePassed factor", () => {
    const past = item({
      expectedCloseDate: "2000-01-01",
      factors: [{ name: "closeDate", points: 20 }],
    });
    render(<DealsTable items={[past]} meta={META} />);

    expect(screen.queryByText("Overdue")).toBeNull();
    expect(screen.getByText("Jan 1, 2000")).toBeTruthy();
  });

  it("shows No date when the deal has no expected close date", () => {
    render(<DealsTable items={[item({ expectedCloseDate: null })]} meta={META} />);

    expect(screen.getByText("No date")).toBeTruthy();
  });

  it("links each title to its deal page", () => {
    render(<DealsTable items={[item({ id: "abc", title: "Big deal" })]} meta={META} />);

    expect(screen.getByRole("link", { name: "Big deal" }).getAttribute("href")).toBe("/deals/abc");
  });

  it("numbers ranks from 21 on page 2", () => {
    const items = [item({ id: "a", title: "A" }), item({ id: "b", title: "B" })];
    render(<DealsTable items={items} meta={{ page: 2, pageSize: 20, total: 22 }} />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]).getAllByRole("cell")[0].textContent).toBe("21");
    expect(within(rows[1]).getAllByRole("cell")[0].textContent).toBe("22");
  });

  it("formats the value with thousands separators", () => {
    render(<DealsTable items={[item({ value: 60000 })]} meta={META} />);

    expect(screen.getByText("60,000")).toBeTruthy();
  });

  it("gives the score meter the API score", () => {
    render(<DealsTable items={[item({ score: 73, title: "Big deal" })]} meta={META} />);

    const meter = screen.getByRole("meter", { name: "Priority score for Big deal" });
    expect(meter.getAttribute("aria-valuenow")).toBe("73");
  });
});
