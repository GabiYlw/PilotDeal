"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormError } from "@/components/ui/field";
import type { ActionState } from "@/lib/form-state";
import { useConfirmedAction } from "@/lib/use-confirmed-action";

export function DeleteInteractionButton({
  action,
  typeLabel,
  dateLabel,
  describedBy,
}: {
  action: (state: ActionState) => Promise<ActionState>;
  typeLabel: string;
  dateLabel: string;
  describedBy: string;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { open, pending, error, openDialog, closeDialog, confirm } = useConfirmedAction(action);
  return (
    <>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="sm"
        aria-describedby={describedBy}
        onClick={openDialog}
      >
        Delete
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete interaction?"
        message={`This permanently deletes the ${typeLabel} interaction from ${dateLabel}. The next action will be recalculated.`}
        confirmLabel="Delete interaction"
        pendingLabel="Deleting..."
        pending={pending}
        onConfirm={confirm}
        onCancel={closeDialog}
        returnFocusRef={triggerRef}
      />
      <FormError message={error} />
    </>
  );
}
