import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompanyForm } from "@/components/companies/company-form";
import type { CompanyField, FormState } from "@/lib/form-state";

const IDLE: FormState<CompanyField> = { status: "idle", fieldErrors: {} };

function stateAction(state: FormState<CompanyField>) {
  return vi.fn<
    (previous: FormState<CompanyField>, data: FormData) => Promise<FormState<CompanyField>>
  >(async () => state);
}

function renderForm(state: FormState<CompanyField>, extra: { onSaved?(): void } = {}) {
  const action = stateAction(state);
  render(
    <CompanyForm
      action={action}
      idPrefix="company"
      ariaLabel="New company"
      submitLabel="Create company"
      pendingLabel="Creating..."
      cancelHref="/companies"
      {...extra}
    />,
  );
  return action;
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create company" }));
  });
}

describe("CompanyForm", () => {
  it("shows the API field error next to Website and links it with aria-describedby", async () => {
    renderForm({
      status: "error",
      fieldErrors: { website: "Enter a valid URL starting with http:// or https://" },
      values: { name: "Acme", industry: "", website: "https://x" },
    });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });

    await submit();

    const message = await screen.findByText("Enter a valid URL starting with http:// or https://");
    const website = screen.getByLabelText("Website (optional)");
    expect(website.getAttribute("aria-invalid")).toBe("true");
    expect(website.getAttribute("aria-describedby")).toBe(message.id);
    expect(screen.getByLabelText("Name").getAttribute("aria-invalid")).toBeNull();
  });

  it("keeps the submitted values after an error and shows the form error as an alert", async () => {
    renderForm({
      status: "error",
      fieldErrors: {},
      formError: "This company no longer exists.",
      values: { name: "Acme", industry: "SaaS", website: "https://acme.test" },
    });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });

    await submit();

    expect((await screen.findByRole("alert")).textContent).toBe("This company no longer exists.");
    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Acme");
    expect(screen.getByLabelText<HTMLInputElement>("Industry (optional)").value).toBe("SaaS");
    expect(screen.getByLabelText<HTMLInputElement>("Website (optional)").value).toBe(
      "https://acme.test",
    );
  });

  it("disables the submit button and shows the pending label while the action runs", async () => {
    let finish: (state: FormState<CompanyField>) => void = () => {};
    const action = vi.fn(() => new Promise<FormState<CompanyField>>((resolve) => (finish = resolve)));
    render(
      <CompanyForm
        action={action}
        idPrefix="company"
        ariaLabel="New company"
        submitLabel="Create company"
        pendingLabel="Creating..."
      />,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });

    await submit();

    const button = screen.getByRole<HTMLButtonElement>("button", { name: "Creating..." });
    expect(button.disabled).toBe(true);
    await act(async () => finish(IDLE));
  });

  it("blocks an empty name with an inline message and does not call the action", async () => {
    const action = renderForm(IDLE);

    await submit();

    expect(screen.getByText("Enter a name.")).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });

  it("clears the inline name message when the user types", async () => {
    renderForm(IDLE);
    await submit();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "A" } });

    expect(screen.queryByText("Enter a name.")).toBeNull();
  });

  it("blocks a website without a protocol with an inline message", async () => {
    const action = renderForm(IDLE);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Website (optional)"), { target: { value: "acme.com" } });

    await submit();

    expect(screen.getByText("Enter a full URL starting with http:// or https://.")).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });

  it("calls onSaved after a successful save", async () => {
    const onSaved = vi.fn();
    renderForm({ status: "success", fieldErrors: {} }, { onSaved });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Acme" } });

    await submit();

    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("links Cancel to cancelHref on the create form", () => {
    renderForm(IDLE);

    expect(screen.getByRole("link", { name: "Cancel" }).getAttribute("href")).toBe("/companies");
  });
});
