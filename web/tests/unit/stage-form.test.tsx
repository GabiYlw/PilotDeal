import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StageForm } from "@/components/deals/stage-form";
import type { FormState, StageField } from "@/lib/form-state";

type Action = (p: FormState<StageField>, d: FormData) => Promise<FormState<StageField>>;

async function submit() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Update stage" }));
  });
}

describe("StageForm", () => {
  it("offers all six stages and defaults to the current one", () => {
    render(<StageForm stage="NEGOTIATION" action={vi.fn<Action>()} />);
    const select = screen.getByLabelText<HTMLSelectElement>("Stage");

    expect(Array.from(select.options).map((o) => o.value)).toEqual([
      "LEAD",
      "QUALIFIED",
      "PROPOSAL",
      "NEGOTIATION",
      "WON",
      "LOST",
    ]);
    expect(select.value).toBe("NEGOTIATION");
  });

  it("sends the chosen stage to the action", async () => {
    const action = vi.fn<Action>(async () => ({ status: "success", fieldErrors: {} }));
    render(<StageForm stage="LEAD" action={action} />);
    fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "WON" } });
    await submit();

    expect(action.mock.calls[0]?.[1].get("stage")).toBe("WON");
  });

  it("shows the stage error linked with aria-describedby", async () => {
    const action = vi.fn<Action>(async () => ({
      status: "error",
      fieldErrors: { stage: "Invalid enum value" },
      values: { stage: "LEAD" },
    }));
    render(<StageForm stage="LEAD" action={action} />);
    await submit();

    const select = await screen.findByLabelText("Stage");
    expect(select.getAttribute("aria-invalid")).toBe("true");
    const errorId = select.getAttribute("aria-describedby");
    expect(document.getElementById(errorId ?? "")?.textContent).toContain("Invalid enum value");
  });

  it("keeps the chosen stage and shows the error after a failed update", async () => {
    const action = vi.fn<Action>(async () => ({
      status: "error",
      fieldErrors: {},
      formError: "Could not save. Please try again.",
      values: { stage: "WON" },
    }));
    render(<StageForm stage="LEAD" action={action} />);
    fireEvent.change(screen.getByLabelText("Stage"), { target: { value: "WON" } });

    await submit();

    await screen.findByRole("alert");
    expect(screen.getByLabelText<HTMLSelectElement>("Stage").value).toBe("WON");
  });

  it("shows a form-level error in an alert", async () => {
    const action = vi.fn<Action>(async () => ({
      status: "error",
      fieldErrors: {},
      formError: "Could not save. Please try again.",
    }));
    render(<StageForm stage="LEAD" action={action} />);
    await submit();

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Could not save. Please try again.",
    );
  });

  it("disables the button and says Updating... while pending", async () => {
    let release: (s: FormState<StageField>) => void = () => {};
    const action = vi.fn<Action>(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    render(<StageForm stage="LEAD" action={action} />);
    await submit();

    const button = screen.getByRole("button", { name: "Updating..." });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    await act(async () => release({ status: "success", fieldErrors: {} }));
    expect(screen.getByRole("button", { name: "Update stage" })).toBeTruthy();
  });
});
