// Browser-side value check shared by the deal create and edit forms (spec requirement 13):
// negative values and values with 3 decimals are blocked inline with one message.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DealCreateForm } from "@/components/companies/deal-create-form";
import { DealEditForm } from "@/components/deals/deal-edit-form";
import type { Deal } from "@/lib/types";

const MESSAGE = "Enter a number of 0 or more with at most 2 decimals.";
const DEAL: Deal = {
  id: "d1",
  companyId: "c1",
  title: "Big deal",
  value: 10,
  stage: "LEAD",
  expectedCloseDate: null,
  closedAt: null,
  createdAt: "",
  updatedAt: "",
};
const idle = async () => ({ status: "idle" as const, fieldErrors: {} });

const FORMS: [string, string, () => void][] = [
  [
    "DealCreateForm",
    "Create deal",
    () => void render(<DealCreateForm action={vi.fn(idle)} onCancel={vi.fn()} />),
  ],
  [
    "DealEditForm",
    "Save changes",
    () => void render(<DealEditForm deal={DEAL} action={vi.fn(idle)} />),
  ],
];

describe.each(FORMS)("%s value check", (_name, submitLabel, renderForm) => {
  async function submitWith(value: string) {
    renderForm();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Big" } });
    fireEvent.change(screen.getByLabelText("Value"), { target: { value } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: submitLabel }));
    });
  }

  it.each([
    ["a negative number", "-5"],
    ["more than two decimals", "1.234"],
  ])("blocks %s inline and marks only Value invalid", async (_case, value) => {
    await submitWith(value);

    expect(screen.getByText(MESSAGE)).toBeTruthy();
    expect(screen.getByLabelText("Value").getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBeNull();
  });

  it("clears the inline value message when the user edits the value", async () => {
    await submitWith("-5");

    fireEvent.change(screen.getByLabelText("Value"), { target: { value: "5" } });

    expect(screen.queryByText(MESSAGE)).toBeNull();
  });
});
