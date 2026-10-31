import { act, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useRef, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function Harness({
  onConfirm,
  onCancel,
  pending = false,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  pending?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(true)}>
        Open
      </button>
      <ConfirmDialog
        open={open}
        title="Delete thing?"
        message="It will be gone."
        confirmLabel="Delete thing"
        pendingLabel="Deleting..."
        pending={pending}
        onConfirm={onConfirm}
        onCancel={() => {
          onCancel();
          setOpen(false);
        }}
        returnFocusRef={triggerRef}
      />
    </>
  );
}

function setup(pending = false) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<Harness onConfirm={onConfirm} onCancel={onCancel} pending={pending} />);
  const trigger = screen.getByRole("button", { name: "Open" });
  act(() => trigger.focus());
  fireEvent.click(trigger);
  return { onConfirm, onCancel, trigger };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConfirmDialog", () => {
  it("renders nothing while closed", () => {
    render(<Harness onConfirm={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a modal dialog named by its title with focus on Cancel", () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, "showModal");

    setup();

    expect(screen.getByRole("dialog", { name: "Delete thing?" })).toBeTruthy();
    expect(showModal).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
  });

  it("describes the dialog with its message", () => {
    setup();

    expect(screen.getByRole("dialog").getAttribute("aria-describedby")).toBe(
      screen.getByText("It will be gone.").id,
    );
  });

  it("calls onConfirm and not onCancel when the confirm button is clicked", () => {
    const { onConfirm, onCancel } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Delete thing" }));

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("calls onCancel and returns focus to the trigger when Cancel is clicked", () => {
    const { onConfirm, onCancel, trigger } = setup();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("cancels on Escape and returns focus to the trigger", () => {
    const { onConfirm, onCancel, trigger } = setup();

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("disables both buttons, shows the pending label and ignores Escape while pending", () => {
    const { onCancel } = setup(true);

    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Cancel" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Deleting..." }).disabled).toBe(
      true,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(onCancel).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});

describe("ConfirmDialog browser-driven closing", () => {
  it.each([
    ["idle", false],
    ["pending", true],
  ])("prevents the native close on cancel when %s", (_name, pending) => {
    setup(pending);

    const event = new Event("cancel", { cancelable: true });
    screen.getByRole("dialog").dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
  });

  it("keeps the parent in step when the browser closes the dialog by itself", async () => {
    const { onCancel } = setup(true);

    await act(async () => screen.getByRole<HTMLDialogElement>("dialog").close());

    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("stays open under React Strict Mode, ignoring the stale close event from the effect re-run", async () => {
    const onCancel = vi.fn();
    render(
      <StrictMode>
        <Harness onConfirm={vi.fn()} onCancel={onCancel} />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("does not throw or move focus when the return target unmounts as the dialog closes", () => {
    function Vanishing() {
      const [state, setState] = useState<"closed" | "open" | "gone">("closed");
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <>
          {state !== "gone" && (
            <button ref={ref} onClick={() => setState("open")}>
              Open
            </button>
          )}
          <ConfirmDialog
            open={state === "open"}
            title="T"
            message="M"
            confirmLabel="Go"
            pendingLabel="..."
            onConfirm={vi.fn()}
            onCancel={() => setState("gone")}
            returnFocusRef={ref}
          />
        </>
      );
    }
    render(<Vanishing />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(() => fireEvent.click(screen.getByRole("button", { name: "Cancel" }))).not.toThrow();

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });
});
