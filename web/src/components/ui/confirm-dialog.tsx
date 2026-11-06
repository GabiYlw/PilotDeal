"use client";

import {
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useEffect,
  useId,
  useRef,
} from "react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm(): void;
  onCancel(): void;
  // Focus goes back here when the dialog closes. An explicit ref, because document.activeElement
  // is <body> in Safari after a button click.
  returnFocusRef: RefObject<HTMLElement | null>;
}

// Controlled by the parent: the <dialog> only exists while open, so every opening starts fresh.
export function ConfirmDialog(props: ConfirmDialogProps) {
  return props.open ? <ConfirmDialogPanel {...props} /> : null;
}

function ConfirmDialogPanel({
  title,
  message,
  confirmLabel,
  pendingLabel,
  cancelLabel = "Cancel",
  pending = false,
  onConfirm,
  onCancel,
  returnFocusRef,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  // showModal gives the top layer, an inert background and aria-modal. Cancel gets the focus
  // because it is the safe choice for a destructive action.
  useEffect(() => {
    const dialog = dialogRef.current;
    const returnTarget = returnFocusRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    cancelRef.current?.focus();
    return () => {
      if (dialog?.open) dialog.close();
      if (returnTarget?.isConnected) returnTarget.focus();
    };
  }, [returnFocusRef]);

  // Escape fires "cancel". Preventing it lets React state close the dialog, so Escape and the
  // Cancel button follow one path. While pending, Escape does nothing.
  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    event.preventDefault();
    if (!pending) onCancel();
  }

  // The browser queues "close" as a task. Strict Mode's effect re-run closes and reopens the
  // dialog, and the queued event then arrives while it is open again: ignore it. Only a dialog
  // the browser really closed by itself (open is false) must keep the parent in step.
  function handleClose() {
    if (dialogRef.current?.open) return;
    onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={handleCancel}
      onClose={handleClose}
      className="m-auto w-full max-w-sm rounded-2xl border border-card-border bg-surface p-6 shadow-raised text-foreground backdrop:bg-overlay"
    >
      <h2 id={titleId} className="text-base font-semibold text-foreground">
        {title}
      </h2>
      <div id={messageId} className="mt-2 text-sm text-muted">
        {message}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button ref={cancelRef} variant="secondary" disabled={pending} onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button variant="danger" disabled={pending} onClick={onConfirm}>
          {pending ? pendingLabel : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
