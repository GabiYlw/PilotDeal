import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompanyDetails } from "@/components/companies/company-details";
import type { CompanyField, FormState } from "@/lib/form-state";
import type { Company } from "@/lib/types";

const COMPANY: Company = {
  id: "c1",
  name: "Acme",
  industry: "SaaS",
  website: "https://acme.test",
  createdAt: "2026-01-05T00:00:00.000Z",
  updatedAt: "",
};

function setup(company: Company = COMPANY) {
  const action = vi.fn<
    (previous: FormState<CompanyField>, data: FormData) => Promise<FormState<CompanyField>>
  >(async () => ({ status: "success", fieldErrors: {} }));
  render(<CompanyDetails company={company} action={action} />);
  return action;
}

describe("CompanyDetails", () => {
  it("shows industry, an external website link and the created date", () => {
    setup();

    expect(screen.getByText("SaaS")).toBeTruthy();
    const link = screen.getByRole("link", { name: "https://acme.test" });
    expect(link.getAttribute("href")).toBe("https://acme.test");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByText("Jan 5, 2026")).toBeTruthy();
  });

  it("shows a placeholder for a missing industry and website", () => {
    setup({ ...COMPANY, industry: null, website: null });

    expect(screen.getAllByText("None")).toHaveLength(2);
  });

  it("opens an edit form prefilled with the current values", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Acme");
    expect(screen.getByLabelText<HTMLInputElement>("Industry (optional)").value).toBe("SaaS");
    expect(screen.getByLabelText<HTMLInputElement>("Website (optional)").value).toBe(
      "https://acme.test",
    );
  });

  it("closes without saving and focuses Edit when the user cancels", () => {
    const action = setup();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(action).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit" }));
  });

  it("closes and focuses Edit after a successful save", async () => {
    const action = setup();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(action).toHaveBeenCalledOnce();
    expect(screen.queryByRole("form")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit" }));
  });
});
