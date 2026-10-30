import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InteractionForm } from "@/components/deals/interaction-form";
import type { FormState, InteractionField } from "@/lib/form-state";

const IDLE: FormState<InteractionField> = { status: "idle", fieldErrors: {} };

function stateAction(state: FormState<InteractionField>) {
  return vi.fn<
    (previous: FormState<InteractionField>, data: FormData) => Promise<FormState<InteractionField>>
  >(async () => state);
}

function typeNotes(text: string) {
  fireEvent.change(screen.getByLabelText("Notes"), { target: { value: text } });
}

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Add interaction" }));
  });
}

describe("InteractionForm", () => {
  it.each(["Type", "Notes", "Date (optional)"])("has a field labelled %s", (label) => {
    render(<InteractionForm dealUpdatedAt="v1" action={stateAction(IDLE)} />);

    expect(screen.getByLabelText(label)).toBeTruthy();
  });

  it("defaults the type to Note", () => {
    render(<InteractionForm dealUpdatedAt="v1" action={stateAction(IDLE)} />);

    expect(screen.getByLabelText<HTMLSelectElement>("Type").value).toBe("NOTE");
  });

  // Blank notes pass the browser check (required only rejects ""), so the API answers 400.
  it("shows the API field error next to Notes and links it with aria-describedby", async () => {
    render(
      <InteractionForm
        dealUpdatedAt="v1"
        action={stateAction({
          status: "error",
          fieldErrors: { notes: "Too small" },
          values: { type: "CALL", notes: "   ", occurredAt: "" },
        })}
      />,
    );
    typeNotes("   ");

    await submit();

    const message = await screen.findByText("Too small");
    const notes = screen.getByLabelText("Notes");
    expect(notes.getAttribute("aria-invalid")).toBe("true");
    expect(notes.getAttribute("aria-describedby")).toBe(message.id);
    expect(screen.getByLabelText("Type").getAttribute("aria-invalid")).toBeNull();
  });

  it("keeps the submitted values after an error", async () => {
    render(
      <InteractionForm
        dealUpdatedAt="v1"
        action={stateAction({
          status: "error",
          fieldErrors: { notes: "Too small" },
          values: { type: "CALL", notes: "draft text", occurredAt: "2026-10-22" },
        })}
      />,
    );
    typeNotes("draft text");

    await submit();

    await screen.findByText("Too small");
    expect(screen.getByLabelText<HTMLTextAreaElement>("Notes").value).toBe("draft text");
    expect(screen.getByLabelText<HTMLSelectElement>("Type").value).toBe("CALL");
  });

  it("shows a form-level error in an alert", async () => {
    const formError = "Could not save. Please try again.";
    render(
      <InteractionForm dealUpdatedAt="v1" action={stateAction({ status: "error", fieldErrors: {}, formError })} />,
    );
    typeNotes("Hello");

    await submit();

    expect((await screen.findByRole("alert")).textContent).toBe(formError);
  });

  it("disables the button and says Adding... while pending", async () => {
    let release: (state: FormState<InteractionField>) => void = () => {};
    const action = vi.fn<
      (previous: FormState<InteractionField>, data: FormData) => Promise<FormState<InteractionField>>
    >(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    render(<InteractionForm dealUpdatedAt="v1" action={action} />);
    typeNotes("Hello");
    await submit();

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Adding..." }).disabled).toBe(true);
    await act(async () => release({ status: "success", fieldErrors: {} }));
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Add interaction" }).disabled).toBe(
      false,
    );
  });

  function fillForm() {
    fireEvent.change(screen.getByLabelText("Type"), { target: { value: "CALL" } });
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Called the buyer" } });
    fireEvent.change(screen.getByLabelText("Date (optional)"), { target: { value: "2026-10-22" } });
  }

  function expectEmptyForm() {
    expect(screen.getByLabelText<HTMLSelectElement>("Type").value).toBe("NOTE");
    expect(screen.getByLabelText<HTMLTextAreaElement>("Notes").value).toBe("");
    expect(screen.getByLabelText<HTMLInputElement>("Date (optional)").value).toBe("");
  }

  it("clears the fields after a successful submit", async () => {
    render(<InteractionForm dealUpdatedAt="v1" action={stateAction({ status: "success", fieldErrors: {} })} />);
    fillForm();

    await submit();

    await screen.findByText("Interaction added.");
    expectEmptyForm();
  });

  it("clears the fields when a submit succeeds after a failed one", async () => {
    const action = stateAction({ status: "success", fieldErrors: {} });
    action.mockResolvedValueOnce({
      status: "error",
      fieldErrors: { occurredAt: "Date cannot be in the future" },
      values: { type: "CALL", notes: "Called the buyer", occurredAt: "2026-10-22" },
    });
    render(<InteractionForm dealUpdatedAt="v1" action={action} />);
    fillForm();
    await submit();
    await screen.findByText("Date cannot be in the future");

    await submit();

    await screen.findByText("Interaction added.");
    expectEmptyForm();
  });

  // Bug: empty notes showed nothing. The browser now blocks the submit and the form shows the
  // error itself instead of the native popup.
  it("shows a field error next to Notes and does not submit when notes are empty", async () => {
    const action = stateAction({ status: "success", fieldErrors: {} });
    render(<InteractionForm action={action} dealUpdatedAt="v1" />);

    await submit();

    const notes = screen.getByLabelText("Notes");
    const message = screen.getByText("Enter some notes.");
    expect(notes.getAttribute("aria-invalid")).toBe("true");
    expect(notes.getAttribute("aria-describedby")).toBe(message.id);
    expect(action).not.toHaveBeenCalled();
  });

  it("clears the browser-side Notes error once the user types", async () => {
    render(<InteractionForm action={stateAction(IDLE)} dealUpdatedAt="v1" />);
    await submit();

    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Hello" } });

    expect(screen.queryByText("Enter some notes.")).toBeNull();
  });

  // Bug: "Interaction added." stayed visible after an unrelated stage update.
  it("hides the success message when the deal changes for another reason", async () => {
    const { rerender } = render(
      <InteractionForm action={stateAction({ status: "success", fieldErrors: {} })} dealUpdatedAt="v1" />,
    );
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Hello" } });
    await submit();
    await screen.findByText("Interaction added.");
    const action = stateAction({ status: "success", fieldErrors: {} });

    rerender(<InteractionForm action={action} dealUpdatedAt="v1" />);
    expect(screen.getByText("Interaction added.")).toBeTruthy();

    rerender(<InteractionForm action={action} dealUpdatedAt="v2" />);
    expect(screen.queryByText("Interaction added.")).toBeNull();
  });

  it("passes the form values to the action", async () => {
    const action = stateAction({ status: "success", fieldErrors: {} });
    render(<InteractionForm dealUpdatedAt="v1" action={action} />);
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Hello" } });

    await submit();

    const formData = action.mock.calls[0][1];
    expect(formData.get("notes")).toBe("Hello");
    expect(formData.get("type")).toBe("NOTE");
  });
});
