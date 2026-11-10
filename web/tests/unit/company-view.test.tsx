import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyView } from "@/components/companies/company-view";
import {
  API_UNREACHABLE,
  ApiError,
  getCompany,
  getCompanyContacts,
  getCompanyDeals,
} from "@/lib/api";
import type { Company, Contact, Deal } from "@/lib/types";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getCompany: vi.fn(),
  getCompanyContacts: vi.fn(),
  getCompanyDeals: vi.fn(),
}));
vi.mock("@/app/clients/[id]/actions", () => ({
  addContact: vi.fn(),
  addDeal: vi.fn(),
  editCompany: vi.fn(),
  editContact: vi.fn(),
  removeCompany: vi.fn(),
  removeContact: vi.fn(),
}));
const NOT_FOUND = new Error("NEXT_NOT_FOUND");
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw NOT_FOUND;
  }),
}));

const company: Company = {
  id: "c1",
  name: "Acme Corp",
  industry: "SaaS",
  website: null,
  createdAt: "2026-01-05T00:00:00.000Z",
  updatedAt: "",
};
const contact: Contact = {
  id: "p1",
  companyId: "c1",
  name: "Ann Lee",
  email: null,
  phone: null,
  role: "CTO",
  createdAt: "",
  updatedAt: "",
};
const deal: Deal = {
  id: "d1",
  companyId: "c1",
  title: "Big deal",
  value: 60000,
  stage: "WON",
  expectedCloseDate: null,
  closedAt: null,
  createdAt: "",
  updatedAt: "",
};

function pageOf<T>(data: T[], total = data.length) {
  return { data, meta: { page: 1, pageSize: 100, total } };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCompany).mockResolvedValue(company);
  vi.mocked(getCompanyContacts).mockResolvedValue(pageOf([contact]));
  vi.mocked(getCompanyDeals).mockResolvedValue(pageOf([deal]));
});

async function renderView() {
  render(await CompanyView({ params: Promise.resolve({ id: "c1" }) }));
}

describe("CompanyView", () => {
  it("shows the company, its contacts and its deals", async () => {
    await renderView();

    expect(screen.getByRole("heading", { name: "Acme Corp" })).toBeTruthy();
    const breadcrumb = within(screen.getByRole("navigation", { name: "Breadcrumb" }));
    expect(breadcrumb.getByRole("link", { name: "Clients" }).getAttribute("href")).toBe("/clients");
    expect(screen.getByRole("button", { name: "Delete client" })).toBeTruthy();
    expect(screen.getByText("Ann Lee")).toBeTruthy();
    // The deals show as a table and as phone cards (CSS picks one; jsdom applies no CSS).
    const table = within(screen.getByRole("table"));
    expect(table.getByRole("link", { name: "Big deal" }).getAttribute("href")).toBe("/deals/d1");
    expect(table.getByText("Won")).toBeTruthy();
    expect(table.getByText("No date")).toBeTruthy();
    const card = within(within(screen.getByRole("list", { name: "Deals" })).getByRole("listitem"));
    expect(card.getByRole("link", { name: "Big deal" }).getAttribute("href")).toBe("/deals/d1");
    expect(card.getByText("Won")).toBeTruthy();
    expect(card.getByText("No date")).toBeTruthy();
  });

  it("fetches contacts and deals with page 1 and pageSize 100", async () => {
    await renderView();

    expect(getCompanyContacts).toHaveBeenCalledWith("c1", { page: 1, pageSize: 100 });
    expect(getCompanyDeals).toHaveBeenCalledWith("c1", { page: 1, pageSize: 100 });
  });

  it("shows empty states when there are no contacts or deals", async () => {
    vi.mocked(getCompanyContacts).mockResolvedValue(pageOf<Contact>([]));
    vi.mocked(getCompanyDeals).mockResolvedValue(pageOf<Deal>([]));
    await renderView();

    expect(screen.getByText("No contacts yet")).toBeTruthy();
    expect(screen.getByText("No deals yet")).toBeTruthy();
  });

  it("says how many are shown when there are more than the page holds", async () => {
    vi.mocked(getCompanyContacts).mockResolvedValue(pageOf([contact], 150));
    vi.mocked(getCompanyDeals).mockResolvedValue(pageOf([deal], 120));
    await renderView();

    expect(screen.getByText("Showing the 1 most recent of 150 contacts.")).toBeTruthy();
    expect(screen.getByText("Showing the 1 most recent of 120 deals.")).toBeTruthy();
  });

  it.each<[string, () => void]>([
    [
      "the company",
      () => vi.mocked(getCompany).mockRejectedValue(new ApiError("x", 404, "NOT_FOUND")),
    ],
    [
      "a non-UUID id",
      () => vi.mocked(getCompany).mockRejectedValue(new ApiError("x", 400, "VALIDATION_ERROR")),
    ],
    [
      "the contacts",
      () => vi.mocked(getCompanyContacts).mockRejectedValue(new ApiError("x", 404, "NOT_FOUND")),
    ],
    [
      "the deals",
      () => vi.mocked(getCompanyDeals).mockRejectedValue(new ApiError("x", 404, "NOT_FOUND")),
    ],
  ])("calls notFound when %s is missing", async (_name, arrange) => {
    arrange();

    await expect(renderView()).rejects.toBe(NOT_FOUND);
  });

  it.each<[string, () => void]>([
    [
      "company",
      () => vi.mocked(getCompany).mockRejectedValue(new ApiError("x", 0, API_UNREACHABLE)),
    ],
    [
      "contacts",
      () => vi.mocked(getCompanyContacts).mockRejectedValue(new ApiError("x", 0, API_UNREACHABLE)),
    ],
    [
      "deals",
      () => vi.mocked(getCompanyDeals).mockRejectedValue(new ApiError("x", 0, API_UNREACHABLE)),
    ],
  ])(
    "renders the unreachable hint when the %s call cannot reach the API",
    async (_name, arrange) => {
      arrange();
      await renderView();

      expect(screen.getByText("Cannot reach the API")).toBeTruthy();
    },
  );
});
