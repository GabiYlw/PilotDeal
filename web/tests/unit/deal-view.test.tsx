import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DealView } from "@/components/deals/deal-view";
import {
  API_UNREACHABLE,
  ApiError,
  getCompany,
  getDeal,
  getDealInteractions,
  getDealNextAction,
} from "@/lib/api";
import type { Deal } from "@/lib/types";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getDeal: vi.fn(),
  getCompany: vi.fn(),
  getDealInteractions: vi.fn(),
  getDealNextAction: vi.fn(),
}));
vi.mock("@/app/deals/[id]/actions", () => ({
  addInteraction: vi.fn(),
  editDeal: vi.fn(),
  updateDealStage: vi.fn(),
  editInteraction: vi.fn(),
  removeInteraction: vi.fn(),
  removeDeal: vi.fn(),
}));
const NOT_FOUND = new Error("NEXT_NOT_FOUND");
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw NOT_FOUND;
  }),
}));

const deal: Deal = {
  id: "d1",
  companyId: "c1",
  title: "Big deal",
  value: 60000,
  stage: "WON",
  expectedCloseDate: "2026-10-22",
  closedAt: "2026-10-23T10:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const company = {
  id: "c1",
  name: "Acme Corp",
  industry: null,
  website: null,
  createdAt: "",
  updatedAt: "",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getDeal).mockResolvedValue(deal);
  vi.mocked(getCompany).mockResolvedValue(company);
  vi.mocked(getDealInteractions).mockResolvedValue({
    data: [],
    meta: { page: 1, pageSize: 100, total: 0 },
  });
  vi.mocked(getDealNextAction).mockRejectedValue(new ApiError("closed", 409, "DEAL_CLOSED"));
});

async function renderView() {
  render(await DealView({ params: Promise.resolve({ id: "d1" }) }));
}

describe("DealView", () => {
  it("shows the title, company link, all-deals link and details", async () => {
    await renderView();

    expect(screen.getByRole("heading", { name: "Big deal" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Acme Corp" }).getAttribute("href")).toBe(
      "/companies/c1",
    );
    expect(screen.getByRole("link", { name: "All deals" }).getAttribute("href")).toBe("/deals");
    expect(screen.getByText("60,000")).toBeTruthy();
    expect(screen.getByText("Closed on")).toBeTruthy();
    expect(screen.getByText("No interactions yet")).toBeTruthy();
  });

  it("shows the edit deal form next to the stage form", async () => {
    await renderView();

    expect(screen.getByRole("form", { name: "Edit deal" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update stage" })).toBeTruthy();
  });

  it("offers to delete the deal from the header", async () => {
    await renderView();

    expect(screen.getByRole("button", { name: "Delete deal" })).toBeTruthy();
  });

  it("fetches the interactions with page 1 and pageSize 100", async () => {
    await renderView();

    expect(getDealInteractions).toHaveBeenCalledWith("d1", { page: 1, pageSize: 100 });
  });

  it("omits Closed on and the overdue badge for an open deal", async () => {
    vi.mocked(getDeal).mockResolvedValue({ ...deal, stage: "LEAD", closedAt: null });
    await renderView();

    expect(screen.queryByText("Closed on")).toBeNull();
    expect(screen.queryByText("Overdue")).toBeNull();
  });

  it.each<[string, () => void]>([
    ["the deal", () => vi.mocked(getDeal).mockRejectedValue(new ApiError("x", 404, "NOT_FOUND"))],
    [
      "a non-UUID deal id",
      () => vi.mocked(getDeal).mockRejectedValue(new ApiError("x", 400, "VALIDATION_ERROR")),
    ],
    [
      "the company",
      () => vi.mocked(getCompany).mockRejectedValue(new ApiError("x", 404, "NOT_FOUND")),
    ],
    [
      "the interactions",
      () => vi.mocked(getDealInteractions).mockRejectedValue(new ApiError("x", 404, "NOT_FOUND")),
    ],
  ])("calls notFound when %s is missing", async (_n, arrange) => {
    arrange();

    await expect(renderView()).rejects.toBe(NOT_FOUND);
  });

  it.each<[string, () => void]>([
    ["deal", () => vi.mocked(getDeal).mockRejectedValue(new ApiError("x", 0, API_UNREACHABLE))],
    [
      "company",
      () => vi.mocked(getCompany).mockRejectedValue(new ApiError("x", 0, API_UNREACHABLE)),
    ],
    [
      "interactions",
      () =>
        vi.mocked(getDealInteractions).mockRejectedValue(new ApiError("x", 0, API_UNREACHABLE)),
    ],
  ])("renders the unreachable hint when the %s call cannot reach the API", async (_n, arrange) => {
    arrange();
    await renderView();

    expect(screen.getByText("Cannot reach the API")).toBeTruthy();
  });
});
