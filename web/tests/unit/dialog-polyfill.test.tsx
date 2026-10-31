import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Guards tests/setup.ts: the polyfill must behave like a browser and must not do the component's job.
function makeDialog() {
  const dialog = document.createElement("dialog");
  const button = document.createElement("button");
  dialog.append(button);
  document.body.append(dialog);
  return { dialog, button };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("jsdom dialog polyfill", () => {
  it("throws InvalidStateError when showModal is called on a disconnected dialog", () => {
    const dialog = document.createElement("dialog");

    expect(() => dialog.showModal()).toThrowError(expect.objectContaining({ name: "InvalidStateError" }));
  });

  it("does not move focus on showModal, so components must focus themselves", () => {
    const { dialog, button } = makeDialog();

    dialog.showModal();

    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(document.body);
    expect(document.activeElement).not.toBe(button);
  });

  it("fires close and stores returnValue on close", async () => {
    const { dialog } = makeDialog();
    const onClose = vi.fn();
    dialog.addEventListener("close", onClose);
    dialog.showModal();

    dialog.close("done");

    expect(dialog.open).toBe(false);
    expect(dialog.returnValue).toBe("done");
    expect(onClose).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("does not fire close when closing a dialog that is not open", async () => {
    const { dialog } = makeDialog();
    const onClose = vi.fn();
    dialog.addEventListener("close", onClose);

    dialog.close();
    await Promise.resolve();

    expect(onClose).not.toHaveBeenCalled();
  });

  it("fires cancel then closes on Escape", () => {
    const { dialog } = makeDialog();
    const onCancel = vi.fn();
    dialog.addEventListener("cancel", onCancel);
    dialog.showModal();

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(false);
  });

  it("keeps the dialog open when cancel is prevented", () => {
    const { dialog } = makeDialog();
    dialog.addEventListener("cancel", (event) => event.preventDefault());
    dialog.showModal();

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(dialog.open).toBe(true);
  });

  it("only cancels the most recently opened modal on Escape", () => {
    const first = makeDialog().dialog;
    const second = makeDialog().dialog;
    first.showModal();
    second.showModal();

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(second.open).toBe(false);
    expect(first.open).toBe(true);
  });

  it("never targets a modal that was removed from the document", () => {
    const first = makeDialog().dialog;
    const second = makeDialog().dialog;
    first.showModal();
    second.showModal();
    second.remove();

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(first.open).toBe(false);
  });

  it("ignores keys other than Escape", () => {
    const { dialog } = makeDialog();
    dialog.showModal();

    fireEvent.keyDown(document.body, { key: "Enter" });

    expect(dialog.open).toBe(true);
  });
});
