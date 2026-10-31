import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CompaniesPage from "@/app/companies/page";

// The list and the notice fetch request-time data; the header is what this test is about.
vi.mock("@/components/companies/companies-list", () => ({ CompaniesList: () => null }));
vi.mock("@/components/companies/company-deleted-notice", () => ({
  CompanyDeletedNotice: () => null,
}));

describe("CompaniesPage", () => {
  it("links the header's New company button to the create form", () => {
    render(<CompaniesPage params={Promise.resolve({})} searchParams={Promise.resolve({})} />);

    const link = screen.getByRole("link", { name: "New company" });
    expect(link.getAttribute("href")).toBe("/companies/new");
  });
});
