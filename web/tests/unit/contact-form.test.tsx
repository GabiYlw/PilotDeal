import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type ContactAction, ContactForm } from "@/components/companies/contact-form";
import type { ContactField, FormState } from "@/lib/form-state";

const IDLE: FormState<ContactField> = { status: "idle", fieldErrors: {} };

function addForm(action: ContactAction, pageVersion?: string) {
  return (
    <ContactForm
      action={action}
      idPrefix="contact"
      ariaLabel="Add contact"
      submitLabel="Add contact"
      pendingLabel="Adding..."
      pageVersion={pageVersion}
    />
  );
}

function renderForm(state: FormState<ContactField>, pageVersion = "v1") {
  const action = vi.fn<ContactAction>(async () => state);
  const view = render(addForm(action, pageVersion));
  return { ...view, action };
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
  });
}

function typeName() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ann" } });
}

describe("ContactForm", () => {
  it("shows the API field error next to Email and links it with aria-describedby", async () => {
    renderForm({
      status: "error",
      fieldErrors: { email: "Enter a valid email address" },
      values: { name: "Ann", email: "x", phone: "", role: "" },
    });
    typeName();

    await submit();

    const message = await screen.findByText("Enter a valid email address");
    const email = screen.getByLabelText("Email (optional)");
    expect(email.getAttribute("aria-invalid")).toBe("true");
    expect(email.getAttribute("aria-describedby")).toBe(message.id);
    expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBeNull();
  });

  it("keeps the submitted values after an error and shows the form error as an alert", async () => {
    renderForm({
      status: "error",
      fieldErrors: {},
      formError: "This company no longer exists.",
      values: { name: "Ann", email: "a@b.co", phone: "123", role: "CTO" },
    });
    typeName();

    await submit();

    expect((await screen.findByRole("alert")).textContent).toBe("This company no longer exists.");
    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Ann");
    expect(screen.getByLabelText<HTMLInputElement>("Email (optional)").value).toBe("a@b.co");
    expect(screen.getByLabelText<HTMLInputElement>("Phone (optional)").value).toBe("123");
    expect(screen.getByLabelText<HTMLInputElement>("Role (optional)").value).toBe("CTO");
  });

  it("confirms with Contact added. and clears the fields after a success", async () => {
    renderForm({ status: "success", fieldErrors: {} });
    typeName();

    await submit();

    expect((await screen.findByRole("status")).textContent).toBe("Contact added.");
    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("");
  });

  // The shared counting rules are covered in interaction-form.test.tsx; these check the wiring.
  it("keeps Contact added. after the new contact arrives, and hides it after a later edit or delete", async () => {
    const { rerender, action } = renderForm({ status: "success", fieldErrors: {} });
    typeName();
    await submit();
    await screen.findByText("Contact added.");

    rerender(addForm(action, "v2"));
    expect(screen.getByText("Contact added.")).toBeTruthy();

    rerender(addForm(action, "v3"));
    expect(screen.queryByText("Contact added.")).toBeNull();
  });

  it("shows no success message without a pageVersion (the edit form)", async () => {
    const action = vi.fn<ContactAction>(async () => ({ status: "success", fieldErrors: {} }));
    render(addForm(action));
    typeName();

    await submit();

    expect(action).toHaveBeenCalled();
    expect(screen.queryByText("Contact added.")).toBeNull();
  });

  it("disables the submit button and shows the pending label while the action runs", async () => {
    let finish: (state: FormState<ContactField>) => void = () => {};
    const action = vi.fn(() => new Promise<FormState<ContactField>>((resolve) => (finish = resolve)));
    render(
      <ContactForm
        action={action}
        idPrefix="contact"
        ariaLabel="Add contact"
        submitLabel="Add contact"
        pendingLabel="Adding..."
      />,
    );
    typeName();

    await submit();

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Adding..." }).disabled).toBe(true);
    await act(async () => finish(IDLE));
  });

  it("blocks an empty name and an invalid email with inline messages", async () => {
    const { action } = renderForm(IDLE);
    fireEvent.change(screen.getByLabelText("Email (optional)"), { target: { value: "nope" } });

    await submit();

    expect(screen.getByText("Enter a name.")).toBeTruthy();
    expect(screen.getByText("Enter a valid email address.")).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });
});
