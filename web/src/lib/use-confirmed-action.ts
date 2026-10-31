import { startTransition, useActionState, useState } from "react";
import { type ActionState, initialFormState } from "./form-state";

// Open/confirm/pending/error logic shared by the two delete buttons.
export function useConfirmedAction(action: (state: ActionState) => Promise<ActionState>) {
  const [open, setOpen] = useState(false);
  const [state, dispatch, pending] = useActionState(async (previous: ActionState) => {
    // No try/catch: a redirect thrown by the action must propagate.
    const next = await action(previous);
    // After an await the update is no longer part of the transition; re-enter it so the dialog
    // closes in the same commit as the revalidated data.
    startTransition(() => setOpen(false));
    return next;
  }, initialFormState<never>());

  return {
    open,
    pending,
    error: state.formError,
    openDialog: () => setOpen(true),
    closeDialog: () => setOpen(false),
    // dispatch must run inside a transition, or React warns and pending stays false.
    confirm: () => startTransition(() => dispatch()),
  };
}
