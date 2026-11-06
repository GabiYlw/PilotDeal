import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HomeStats } from "@/components/home-stats";
import { API_UNREACHABLE, ApiError, getCompanies, getPrioritizedDeals } from "@/lib/api";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getPrioritizedDeals: vi.fn(),
  getCompanies: vi.fn(),
}));

function page(total: number) {
  return { data: [], meta: { page: 1, pageSize: 1, total } };
}

describe("HomeStats", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows the totals the API returns for open deals and companies", async () => {
    vi.mocked(getPrioritizedDeals).mockResolvedValue(page(7));
    vi.mocked(getCompanies).mockResolvedValue(page(12));

    render(await HomeStats());

    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Open deals",
      "Companies",
    ]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "7",
      "12",
    ]);
    expect(vi.mocked(getPrioritizedDeals)).toHaveBeenCalledWith({ page: 1, pageSize: 1 });
  });

  it.each([
    ["the API is unreachable", new ApiError("down", 0, API_UNREACHABLE)],
    ["the API answers with an error", new ApiError("boom", 500, "INTERNAL_ERROR")],
  ])("renders nothing when %s", async (_name, error) => {
    vi.mocked(getPrioritizedDeals).mockRejectedValue(error);
    vi.mocked(getCompanies).mockResolvedValue(page(3));

    expect(await HomeStats()).toBeNull();
  });

  it("rethrows errors that are not API errors", async () => {
    vi.mocked(getPrioritizedDeals).mockRejectedValue(new Error("API_URL is not set"));
    vi.mocked(getCompanies).mockResolvedValue(page(3));

    await expect(HomeStats()).rejects.toThrow("API_URL is not set");
  });
});
