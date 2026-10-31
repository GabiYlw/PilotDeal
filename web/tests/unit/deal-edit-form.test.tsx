import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DealEditForm } from "@/components/deals/deal-edit-form";
import type { DealEditField, FormState } from "@/lib/form-state";
import type { Deal } from "@/lib/types";

const IDLE: FormState<DealEditField> = { status: "idle", fieldErrors: {} };
const DEAL: Deal = {
  id: "d1",
  companyId: "c1",
  title: "Big deal",
  value: 1500.5,
  stage: "LEAD",
  expectedCloseDate: "2026-10-22",
  closedAt: null,
  createdAt: "",
  updatedAt: "",
};

function renderForm(state: FormState<DealEditField>, deal: Deal = DEAL) {
  const action = vi.fn<
    (previous: FormState<DealEditField>, data: FormData) => Promise<FormState<DealEditField>>
  >(async () => state);
  render(<DealEditForm deal={deal} action={action} />);
  return action;
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  });
}

describe("DealEditForm", () => {
  it("is prefilled with the deal title, value and expected close date", () => {
    renderForm(IDLE);

    expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("Big deal");
    expect(screen.getByLabelText<HTMLInputElement>("Value").value).toBe("1500.5");
    expect(screen.getByLabelText<HTMLInputElement>("Expected close date (optional)").value).toBe(
      "2026-10-22",
    );
  });

  it("leaves the date empty when the deal has none", () => {
    renderForm(IDLE, { ...DEAL, expectedCloseDate: null });

    expect(screen.getByLabelText<HTMLInputElement>("Expected close date (optional)").value).toBe("");
  });

  it("shows Deal saved. after a successful save", async () => {
    renderForm({ status: "success", fieldErrors: {} });

    await submit();

    expect((await screen.findByRole("status")).textContent).toBe("Deal saved.");
  });

  it("shows the API field error next to Title and links it with aria-describedby", async () => {
    renderForm({
      status: "error",
      fieldErrors: { title: "Title is required" },
      values: { title: "  ", value: "10", expectedCloseDate: "" },
    });

    await submit();

    const message = await screen.findByText("Title is required");
    const title = screen.getByLabelText("Title");
    expect(title.getAttribute("aria-invalid")).toBe("true");
    expect(title.getAttribute("aria-describedby")).toBe(message.id);
    expect(screen.getByLabelText("Value").getAttribute("aria-invalid")).toBeNull();
  });

  it("keeps the submitted values and shows the form error as an alert", async () => {
    renderForm({
      status: "error",
      fieldErrors: {},
      formError: "This deal no longer exists.",
      values: { title: "Draft", value: "7", expectedCloseDate: "" },
    });

    await submit();

    expect((await screen.findByRole("alert")).textContent).toBe("This deal no longer exists.");
    expect(screen.getByLabelText<HTMLInputElement>("Title").value).toBe("Draft");
    expect(screen.getByLabelText<HTMLInputElement>("Value").value).toBe("7");
    expect(screen.getByLabelText<HTMLInputElement>("Expected close date (optional)").value).toBe("");
  });

  it("disables the submit button and shows the pending label while the action runs", async () => {
    let finish: (state: FormState<DealEditField>) => void = () => {};
    const action = vi.fn(
      () => new Promise<FormState<DealEditField>>((resolve) => (finish = resolve)),
    );
    render(<DealEditForm deal={DEAL} action={action} />);

    await submit();

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Saving..." }).disabled).toBe(true);
    await act(async () => finish(IDLE));
  });

  it("blocks an emptied title with an inline message", async () => {
    const action = renderForm(IDLE);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "" } });

    await submit();

    expect(screen.getByText("Enter a title.")).toBeTruthy();
    expect(action).not.toHaveBeenCalled();
  });
});
