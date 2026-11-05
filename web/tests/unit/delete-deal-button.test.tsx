import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteDealButton } from "@/components/deals/delete-deal-button";
import type { ActionState } from "@/lib/form-state";

const SUCCESS: ActionState = { status: "success", fieldErrors: {} };

function setup(result: ActionState = SUCCESS) {
  const action = vi.fn<(state: ActionState) => Promise<ActionState>>(async () => result);
  render(<DeleteDealButton dealTitle="Big deal" action={action} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete deal" }));
  return action;
}

describe("DeleteDealButton", () => {
  it("asks for confirmation naming the deal and its interactions", () => {
    setup();

    const dialog = screen.getByRole("dialog", { name: "Delete deal?" });
    expect(dialog.textContent).toContain('"Big deal"');
    expect(dialog.textContent).toContain("all of its interactions");
  });

  it("does not delete when the user cancels", () => {
    const action = setup();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(action).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("runs the action when the user confirms", async () => {
    const action = setup();

    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Delete deal" }),
      );
    });

    expect(action).toHaveBeenCalledOnce();
  });

  it("closes the dialog and shows the error when the action fails", async () => {
    setup({ status: "error", fieldErrors: {}, formError: "Could not delete. Please try again." });

    await act(async () => {
      fireEvent.click(
        within(screen.getByRole("dialog")).getByRole("button", { name: "Delete deal" }),
      );
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe("Could not delete. Please try again.");
  });
});
