import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Vitest globals are off, so Testing Library cannot register its own cleanup.
afterEach(() => {
  cleanup();
});

// jsdom has no <dialog> behavior (no showModal, close, Escape or cancel/close events). This
// emulates only what a browser does by itself, so component tests can run. It never touches
// component logic, and focus is deliberately not emulated: tests must show that ConfirmDialog
// moves focus itself. close is queued as a microtask like browsers queue it as a task, so it can
// arrive after the dialog was closed and reopened (React Strict Mode does exactly that); tests
// must await it. It only applies when the DOM lacks showModal, so a
// jsdom with real support is used as is, and node-environment test files skip it.
const openModals = new Set<HTMLDialogElement>();

if (
  typeof HTMLDialogElement !== "undefined" &&
  typeof HTMLDialogElement.prototype.showModal !== "function"
) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    if (!this.isConnected) {
      throw new DOMException("The dialog is not connected to a document.", "InvalidStateError");
    }
    if (this.open) return;
    this.setAttribute("open", "");
    openModals.add(this);
  };

  HTMLDialogElement.prototype.close = function close(
    this: HTMLDialogElement,
    returnValue?: string,
  ) {
    if (!this.open) return;
    this.removeAttribute("open");
    openModals.delete(this);
    if (returnValue !== undefined) this.returnValue = returnValue;
    queueMicrotask(() => this.dispatchEvent(new Event("close")));
  };

  // Escape: the browser fires a cancelable "cancel" event, then closes unless it was prevented.
  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Escape") return;
      // A dialog removed from the document leaves the top layer, so it can never be the target.
      for (const modal of openModals) if (!modal.isConnected) openModals.delete(modal);
      const top = [...openModals].at(-1);
      if (top && top.dispatchEvent(new Event("cancel", { cancelable: true }))) top.close();
    },
    true,
  );
}
