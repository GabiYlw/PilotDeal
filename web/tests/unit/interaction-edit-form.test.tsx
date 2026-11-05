import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InteractionEditForm } from "@/components/deals/interaction-edit-form";
import type { FormState, InteractionField } from "@/lib/form-state";
import type { Interaction } from "@/lib/types";

const INTERACTION: Interaction = {
  id: "i1",
  dealId: "d1",
  type: "CALL",
  notes: "Called the buyer",
  occurredAt: "2026-10-22T23:30:00.000Z",
  createdAt: "2026-10-22T23:30:00.000Z",
  updatedAt: "2026-10-22T23:30:00.000Z",
};
type Result = FormState<InteractionField>;

function setup(
  action = vi.fn<(s: Result, d: FormData) => Promise<Result>>(async () => ({
    status: "idle",
    fieldErrors: {},
  })),
) {
  const onCancel = vi.fn();
  const onSaved = vi.fn();
  render(
    <InteractionEditForm
      interaction={INTERACTION}
      action={action}
      onCancel={onCancel}
      onSaved={onSaved}
    />,
  );
  return { action, onCancel, onSaved };
}

const save = () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });

describe("InteractionEditForm browser validation", () => {
  it.each([
    ["Notes", "", "Enter some notes."],
    ["Date", "", "Enter a date."],
  ])(
    "blocks the submit and shows an inline error when %s is empty",
    async (label, value, message) => {
      const { action } = setup();
      fireEvent.change(screen.getByLabelText(label), { target: { value } });

      await save();

      const text = screen.getByText(message);
      expect(screen.getByLabelText(label).getAttribute("aria-describedby")).toBe(text.id);
      expect(screen.getByLabelText(label).getAttribute("aria-invalid")).toBe("true");
      expect(action).not.toHaveBeenCalled();
    },
  );

  it("clears the inline error once the user types in the field", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "" } });
    await save();
    expect(screen.getByText("Enter some notes.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "x" } });

    expect(screen.queryByText("Enter some notes.")).toBeNull();
  });
});

describe("InteractionEditForm submit", () => {
  it("sends the prefilled values to the action", async () => {
    const { action } = setup();

    await save();

    const data = action.mock.calls[0][1];
    expect(Object.fromEntries(data.entries())).toEqual({
      type: "CALL",
      notes: "Called the buyer",
      occurredAt: "2026-10-22",
    });
  });

  it("shows Saving... and disables Save and Cancel while the save is pending", async () => {
    let release: (s: Result) => void = () => {};
    const { onSaved } = setup(
      vi.fn(
        () =>
          new Promise<Result>((resolve) => {
            release = resolve;
          }),
      ),
    );

    await save();

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Saving..." }).disabled).toBe(
      true,
    );
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Cancel" }).disabled).toBe(true);
    await act(async () => release({ status: "success", fieldErrors: {} }));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("does not report a save when the action returns an error", async () => {
    const { onSaved } = setup(
      vi.fn(async (): Promise<Result> => ({ status: "error", fieldErrors: {}, formError: "bad" })),
    );

    await save();

    expect(onSaved).not.toHaveBeenCalled();
  });

  it("calls onCancel from the Cancel button without submitting", () => {
    const { action, onCancel } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(action).not.toHaveBeenCalled();
  });
});
