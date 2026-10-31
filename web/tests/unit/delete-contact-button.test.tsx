import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteContactButton } from "@/components/companies/delete-contact-button";
import type { ActionState } from "@/lib/form-state";

const SUCCESS: ActionState = { status: "success", fieldErrors: {} };

function setup(result: ActionState = SUCCESS) {
  const action = vi.fn<(state: ActionState) => Promise<ActionState>>(async () => result);
  render(
    <>
      <p id="summary">Ann</p>
      <DeleteContactButton action={action} contactName="Ann" describedBy="summary" />
    </>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Delete" }));
  return action;
}

async function confirm() {
  await act(async () => {
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Delete contact" }),
    );
  });
}

describe("DeleteContactButton", () => {
  it("asks for confirmation naming the contact", () => {
    setup();

    const dialog = screen.getByRole("dialog", { name: "Delete contact?" });
    expect(dialog.textContent).toContain('"Ann"');
  });

  it("does not delete when the user cancels", () => {
    const action = setup();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("runs the action once when the user confirms", async () => {
    const action = setup();

    await confirm();

    expect(action).toHaveBeenCalledOnce();
  });

  it("closes the dialog and shows the error when the action fails", async () => {
    setup({ status: "error", fieldErrors: {}, formError: "Could not delete. Please try again." });

    await confirm();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Could not delete. Please try again.");
  });
});
