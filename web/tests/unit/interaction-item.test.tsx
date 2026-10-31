import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InteractionItem } from "@/components/deals/interaction-item";
import type { ActionState, FormState, InteractionField } from "@/lib/form-state";
import { INTERACTION_NOT_FOUND_MESSAGE } from "@/lib/messages";
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
const SUCCESS: FormState<InteractionField> = { status: "success", fieldErrors: {} };

function setup({
  editResult = SUCCESS,
  removeResult = { status: "success", fieldErrors: {} } as ActionState,
} = {}) {
  const edit = vi.fn<
    (state: FormState<InteractionField>, data: FormData) => Promise<FormState<InteractionField>>
  >(async () => editResult);
  const remove = vi.fn<(state: ActionState) => Promise<ActionState>>(async () => removeResult);
  render(
    <InteractionItem interaction={INTERACTION} dateLabel="Oct 22, 2026" edit={edit} remove={remove} />,
  );
  return { edit, remove };
}

function openEditor() {
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
}

describe("InteractionItem view mode", () => {
  it("points Edit and Delete at the summary with the type and the date", () => {
    setup();

    const summary = document.getElementById("interaction-i1-summary");
    expect(summary?.textContent).toContain("Call");
    expect(summary?.textContent).toContain("Oct 22, 2026");
    for (const name of ["Edit", "Delete"]) {
      expect(screen.getByRole("button", { name }).getAttribute("aria-describedby")).toBe(
        "interaction-i1-summary",
      );
    }
  });
});

describe("InteractionItem editing", () => {
  it("opens a prefilled form with focus on the Type select", () => {
    setup();

    openEditor();

    const form = screen.getByRole("form", { name: "Edit interaction" });
    const type = within(form).getByLabelText<HTMLSelectElement>("Type");
    expect(type.value).toBe("CALL");
    expect(document.activeElement).toBe(type);
    expect(within(form).getByLabelText<HTMLTextAreaElement>("Notes").value).toBe("Called the buyer");
    expect(within(form).getByLabelText<HTMLInputElement>("Date").value).toBe("2026-10-22");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("shows API field errors on the field and keeps the submitted values", async () => {
    setup({
      editResult: {
        status: "error",
        fieldErrors: { notes: "Too small" },
        values: { type: "EMAIL", notes: "   ", occurredAt: "2026-10-23" },
      },
    });
    openEditor();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    const message = screen.getByText("Too small");
    const notes = screen.getByLabelText<HTMLTextAreaElement>("Notes");
    expect(notes.getAttribute("aria-invalid")).toBe("true");
    expect(notes.getAttribute("aria-describedby")).toBe(message.id);
    expect(notes.value).toBe("   ");
    expect(screen.getByLabelText<HTMLSelectElement>("Type").value).toBe("EMAIL");
    expect(screen.getByLabelText<HTMLInputElement>("Date").value).toBe("2026-10-23");
  });

  it("shows a form-level error in an alert", async () => {
    setup({
      editResult: { status: "error", fieldErrors: {}, formError: INTERACTION_NOT_FOUND_MESSAGE },
    });
    openEditor();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(screen.getByRole("alert").textContent).toBe(INTERACTION_NOT_FOUND_MESSAGE);
  });

  it("restores the original values and focuses Edit when Cancel is clicked", () => {
    setup();
    openEditor();
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "EMAIL" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Changed" } });
    fireEvent.change(screen.getByLabelText("Date"), { target: { value: "2026-01-01" } });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Called the buyer")).toBeTruthy();
    const edit = screen.getByRole("button", { name: "Edit" });
    expect(document.activeElement).toBe(edit);
    fireEvent.click(edit);
    expect(screen.getByLabelText<HTMLSelectElement>("Type").value).toBe("CALL");
    expect(screen.getByLabelText<HTMLTextAreaElement>("Notes").value).toBe("Called the buyer");
    expect(screen.getByLabelText<HTMLInputElement>("Date").value).toBe("2026-10-22");
  });

  it("restores the original values when Cancel follows a failed save", async () => {
    setup({
      editResult: {
        status: "error",
        fieldErrors: { notes: "Too small" },
        values: { type: "EMAIL", notes: "draft", occurredAt: "2026-10-23" },
      },
    });
    openEditor();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    openEditor();

    expect(screen.getByLabelText<HTMLTextAreaElement>("Notes").value).toBe("Called the buyer");
    expect(screen.queryByText("Too small")).toBeNull();
  });

  it("closes the form and focuses Edit after a successful save", async () => {
    setup();
    openEditor();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(screen.queryByRole("form", { name: "Edit interaction" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Edit" }));
  });
});

describe("InteractionItem delete", () => {
  function confirmDelete() {
    return act(async () => {
      fireEvent.click(
        within(screen.getByRole("dialog", { name: "Delete interaction?" })).getByRole("button", {
          name: "Delete interaction",
        }),
      );
    });
  }

  it("deletes after the user confirms", async () => {
    const { remove } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog").textContent).toContain("Call interaction from Oct 22, 2026");

    await confirmDelete();

    expect(remove).toHaveBeenCalledOnce();
  });

  it("does not delete when the user cancels", () => {
    const { remove } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(remove).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the dialog and shows the error in the item when the delete fails", async () => {
    setup({
      removeResult: { status: "error", fieldErrors: {}, formError: INTERACTION_NOT_FOUND_MESSAGE },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await confirmDelete();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("alert").textContent).toBe(INTERACTION_NOT_FOUND_MESSAGE);
  });
});
