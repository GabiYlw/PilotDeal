"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormError } from "@/components/ui/field";
import type { ActionState } from "@/lib/form-state";
import { useConfirmedAction } from "@/lib/use-confirmed-action";

export function DeleteDealButton({
  dealTitle,
  action,
}: {
  dealTitle: string;
  action: (state: ActionState) => Promise<ActionState>;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { open, pending, error, openDialog, closeDialog, confirm } = useConfirmedAction(action);
  return (
    <div className="flex flex-col gap-1 sm:items-end">
      <Button ref={triggerRef} variant="secondary" size="sm" onClick={openDialog}>
        Delete deal
      </Button>
      <ConfirmDialog
        open={open}
        title="Delete deal?"
        message={`"${dealTitle}" and all of its interactions will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete deal"
        pendingLabel="Deleting..."
        pending={pending}
        onConfirm={confirm}
        onCancel={closeDialog}
        returnFocusRef={triggerRef}
      />
      <FormError message={error} />
    </div>
  );
}
