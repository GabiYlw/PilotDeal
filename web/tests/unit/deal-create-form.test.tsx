import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DealCreateForm } from "@/components/companies/deal-create-form";
import type { DealField, FormState } from "@/lib/form-state";

const IDLE: FormState<DealField> = { status: "idle", fieldErrors: {} };

function renderForm(state: FormState<DealField>) {
  const action = vi.fn<
    (previous: FormState<DealField>, data: FormData) => Promise<FormState<DealField>>
  >(async () => state);
  render(<DealCreateForm action={action} onCancel={vi.fn()} />);
  return action;
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Create deal" }));
  });
}

function fillRequired() {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Big" } });
  fireEvent.change(screen.getByLabelText("Value"), { target: { value: "10" } });
}

describe("DealCreateForm", () => {
  it("defaults the stage to Lead and lists all six stages", () => {
    renderForm(IDLE);

    const stage = screen.getByLabelText<HTMLSelectElement>("Stage");
    expect(stage.value).toBe("LEAD");
    expect(Array.from(stage.options).map((option) => option.textContent)).toEqual([
      "Lead",
      "Qualified",
      "Proposal",
      "Negotiation",
      "Won",
      "Lost",
    ]);
  });

  it("shows the API field error next to Value and links it with aria-describedby", async () => {
    renderForm({
      status: "error",
      fieldErrors: { value: "Too big" },
      values: { title: "Big", value: "99999999999", stage: "LEAD", expectedCloseDate: "" },
    });
    fillRequired();

    await submit();

    const message = await screen.findByText("Too big");
    const value = screen.getByLabelText("Value");
    expect(value.getAttribute("aria-invalid")).toBe("true");
    expect(value.getAttribute("aria-describedby")).toBe(message.id);
    expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBeNull();
  });

  it("keeps the submitted values, including the stage, after an error", async () => {
    renderForm({
      status: "error",
      fieldErrors: {},
      formError: "This company no longer exists.",
      values: { title: "Big", value: "10", stage: "PROPOSAL", expectedCloseDate: "2026-12-01" },
    });
    fillRequired();

    await submit();

    expect((await screen.findByRole("alert")).textContent).toBe("This company no longer exists.");
    expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("Big");
    expect(screen.getByLabelText<HTMLInputElement>("Value").value).toBe("10");
    expect(screen.getByLabelText<HTMLSelectElement>("Stage").value).toBe("PROPOSAL");
    expect(screen.getByLabelText<HTMLInputElement>("Expected close date (optional)").value).toBe(
      "2026-12-01",
    );
  });

  it("disables the submit button and shows the pending label while the action runs", async () => {
    let finish: (state: FormState<DealField>) => void = () => {};
    const action = vi.fn(() => new Promise<FormState<DealField>>((resolve) => (finish = resolve)));
    render(<DealCreateForm action={action} onCancel={vi.fn()} />);
    fillRequired();

    await submit();

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Creating..." }).disabled).toBe(
      true,
    );
    await act(async () => finish(IDLE));
  });

  it("blocks an empty title and value with inline messages", async () => {
    const action = renderForm(IDLE);

    await submit();

    expect(screen.getByText("Enter a title.")).toBeTruthy();
    expect(
      screen.getByText("Enter a number of 0 or more with at most 2 decimals."),
    ).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });
});
