import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompaniesList } from "@/components/companies/companies-list";
import { API_UNREACHABLE, ApiError, getCompanies } from "@/lib/api";
import type { Company } from "@/lib/types";

vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  getCompanies: vi.fn(),
}));

const companies: Company[] = [
  {
    id: "c1",
    name: "Acme",
    industry: "SaaS",
    website: "https://acme.test",
    createdAt: "",
    updatedAt: "",
  },
  { id: "c2", name: "Beta", industry: null, website: null, createdAt: "", updatedAt: "" },
  { id: "c3", name: "Gamma", industry: null, website: null, createdAt: "", updatedAt: "" },
];

function page(data: Company[], total: number, pageNumber = 1) {
  return { data, meta: { page: pageNumber, pageSize: 20, total } };
}

async function renderList(params: Record<string, string | string[] | undefined> = {}) {
  render(await CompaniesList({ searchParams: Promise.resolve(params) }));
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getCompanies).mockResolvedValue(page(companies, 3));
});

describe("CompaniesList", () => {
  it("renders a table with a link per company and the external website link", async () => {
    await renderList();

    expect(screen.getByRole("columnheader", { name: "Name" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Industry" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Website" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Acme" }).getAttribute("href")).toBe("/companies/c1");
    const website = screen.getByRole("link", { name: "https://acme.test" });
    expect(website.getAttribute("href")).toBe("https://acme.test");
    expect(website.getAttribute("target")).toBe("_blank");
    expect(website.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getAllByText("None").length).toBe(4);
  });

  it.each<[string, string | string[] | undefined, number]>([
    ["a valid page", "3", 3],
    ["an invalid page", "abc", 1],
    ["a repeated page", ["2", "3"], 1],
    ["no page", undefined, 1],
  ])("requests %s", async (_name, param, expected) => {
    await renderList({ page: param });

    expect(getCompanies).toHaveBeenCalledWith({ page: expected, pageSize: 20 });
  });

  it("offers to create the first company when there are none", async () => {
    vi.mocked(getCompanies).mockResolvedValue(page([], 0));
    await renderList();

    expect(screen.getByText("No companies yet")).toBeTruthy();
    expect(screen.getByRole("link", { name: "New company" }).getAttribute("href")).toBe(
      "/companies/new",
    );
  });

  it("says the page is empty when it is beyond the last one", async () => {
    vi.mocked(getCompanies).mockResolvedValue(page([], 3, 5));
    await renderList({ page: "5" });

    expect(screen.getByText("This page is empty")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to the first page" }).getAttribute("href")).toBe(
      "/companies",
    );
  });

  it("shows pagination links only when there is more than one page", async () => {
    vi.mocked(getCompanies).mockResolvedValue(page(companies, 45));
    await renderList();

    expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe(
      "/companies?page=2",
    );
  });

  it("does not show pagination for a single page", async () => {
    await renderList();

    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });

  it("renders the unreachable hint when the API is down", async () => {
    vi.mocked(getCompanies).mockRejectedValue(new ApiError("x", 0, API_UNREACHABLE));
    await renderList();

    expect(screen.getByText("Cannot reach the API")).toBeTruthy();
  });
});
