import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContactItem } from "@/components/companies/contact-item";
import type { ContactAction } from "@/components/companies/contact-form";
import type { Contact } from "@/lib/types";

const CONTACT: Contact = {
  id: "p1",
  companyId: "c1",
  name: "Ann Lee",
  email: "ann@acme.test",
  phone: null,
  role: "CTO",
  createdAt: "",
  updatedAt: "",
};

function setup(contact: Contact = CONTACT) {
  const edit = vi.fn<ContactAction>(async () => ({ status: "success", fieldErrors: {} }));
  return render(<ContactItem contact={contact} edit={edit} remove={vi.fn()} />);
}

describe("ContactItem", () => {
  it("shows the name and only the details that are set", () => {
    const { container } = setup();

    expect(screen.getByText("Ann Lee")).toBeTruthy();
    expect(screen.getByText("CTO")).toBeTruthy();
    expect(screen.getByText("ann@acme.test")).toBeTruthy();
    // Name, role and email only: the missing phone adds no row.
    expect(container.querySelector("#contact-p1-summary")?.children).toHaveLength(3);
  });

  it("opens an edit form prefilled with the current values", () => {
    setup();

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Ann Lee");
    expect(screen.getByLabelText<HTMLInputElement>("Email (optional)").value).toBe("ann@acme.test");
    expect(screen.getByLabelText<HTMLInputElement>("Phone (optional)").value).toBe("");
    expect(screen.getByLabelText<HTMLInputElement>("Role (optional)").value).toBe("CTO");
  });

  it("returns to the read view and focuses Edit when the user cancels", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("form")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit" }));
  });

  it("returns to the read view and focuses Edit after a successful save", async () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(screen.queryByRole("form")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit" }));
  });
});
