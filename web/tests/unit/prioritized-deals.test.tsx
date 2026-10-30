import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PrioritizedDeals } from "@/components/deals/prioritized-deals";
import { API_UNREACHABLE, ApiError, getPrioritizedDeals } from "@/lib/api";
import type { PrioritizedDeal } from "@/lib/types";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getPrioritizedDeals: vi.fn(),
}));
vi.mock("next/navigation", () => ({ notFound: vi.fn() }));

const mock = vi.mocked(getPrioritizedDeals);

function item(id: string): PrioritizedDeal {
  return {
    deal: {
      id,
      companyId: "c1",
      companyName: "Acme",
      title: `Deal ${id}`,
      value: 1000,
      stage: "LEAD",
      expectedCloseDate: null,
      closedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
    priority: { score: 50, reason: "r", nextAction: "n", factors: [], scoredBy: "rules" },
  };
}

async function renderList(page?: string | string[]) {
  render(await PrioritizedDeals({ searchParams: Promise.resolve({ page }) }));
}

describe("PrioritizedDeals", () => {
  beforeEach(() => vi.resetAllMocks());

  it.each<[string, string | string[] | undefined, number]>([
    ["a missing page", undefined, 1],
    ["abc", "abc", 1],
    ["0", "0", 1],
    ["an array", ["2", "3"], 1],
    ["1000000", "1000000", 1],
    ["3", "3", 3],
  ])("requests %s as page %i with pageSize 20", async (_n, param, expected) => {
    mock.mockResolvedValue({ data: [item("a")], meta: { page: expected, pageSize: 20, total: 1 } });
    await renderList(param);

    expect(mock).toHaveBeenCalledWith({ page: expected, pageSize: 20 });
  });

  it("shows No open deals and no table when total is 0", async () => {
    mock.mockResolvedValue({ data: [], meta: { page: 1, pageSize: 20, total: 0 } });
    await renderList();

    expect(screen.getByText("No open deals")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows This page is empty with a link to /deals past the end", async () => {
    mock.mockResolvedValue({ data: [], meta: { page: 9, pageSize: 20, total: 5 } });
    await renderList("9");

    expect(screen.getByText("This page is empty")).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe("/deals");
  });

  it("renders the table in the API order with pagination", async () => {
    mock.mockResolvedValue({
      data: [item("b"), item("a")],
      meta: { page: 1, pageSize: 2, total: 4 },
    });
    await renderList();

    const links = screen.getAllByRole("link").map((l) => l.getAttribute("href"));
    expect(links.slice(0, 2)).toEqual(["/deals/b", "/deals/a"]);
    expect(links).toContain("/deals?page=2");
  });

  it("shows the API hint when the API is unreachable", async () => {
    mock.mockRejectedValue(new ApiError("down", 0, API_UNREACHABLE));
    await renderList();

    expect(screen.getByText("Cannot reach the API")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("rethrows other API errors", async () => {
    mock.mockRejectedValue(new ApiError("boom", 500, "INTERNAL"));

    await expect(renderList()).rejects.toThrow("boom");
  });
});
