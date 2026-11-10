"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FormError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { errorProps, useBrowserErrors } from "@/lib/browser-validation";
import { INTERACTION_TYPE_LABELS } from "@/lib/deal-display";
import { type FormState, type InteractionField, initialFormState } from "@/lib/form-state";
import { toDateInputValue } from "@/lib/format";
import { INTERACTION_TYPES, type Interaction } from "@/lib/types";

export type EditInteractionAction = (
  state: FormState<InteractionField>,
  formData: FormData,
) => Promise<FormState<InteractionField>>;

// Mounted only while editing, so closing it discards its state: the next Edit starts from the
// saved values of the interaction.
export function InteractionEditForm({
  interaction,
  action,
  onCancel,
  onSaved,
}: {
  interaction: Interaction;
  action: EditInteractionAction;
  onCancel(): void;
  onSaved(): void;
}) {
  const [state, formAction, pending] = useActionState(
    async (previous: FormState<InteractionField>, formData: FormData) => {
      const next = await action(previous, formData);
      // Re-enter the transition after the await so leaving edit mode commits with the new data.
      if (next.status === "success") startTransition(onSaved);
      return next;
    },
    initialFormState<InteractionField>(),
  );
  const { browserErrors, blockedBy, clearBrowserError, resetBrowserErrors } =
    useBrowserErrors<InteractionField>();
  const typeRef = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    typeRef.current?.focus();
  }, []);

  const base = `interaction-${interaction.id}`;
  const fieldErrors = { ...state.fieldErrors, ...browserErrors };
  const { values } = state;
  // The select needs a key: React ignores a new defaultValue on a mounted select.
  const type = values?.type ?? interaction.type;
  return (
    <form
      action={formAction}
      onSubmit={resetBrowserErrors}
      aria-label="Edit interaction"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${base}-type`}>Type</Label>
        <Select
          key={type}
          ref={typeRef}
          id={`${base}-type`}
          name="type"
          defaultValue={type}
          {...errorProps(`${base}-type`, fieldErrors.type)}
        >
          {INTERACTION_TYPES.map((option) => (
            <option key={option} value={option}>
              {INTERACTION_TYPE_LABELS[option]}
            </option>
          ))}
        </Select>
        <FieldError id={`${base}-type-error`} message={fieldErrors.type} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${base}-notes`}>Notes</Label>
        <Textarea
          id={`${base}-notes`}
          name="notes"
          required
          defaultValue={values?.notes ?? interaction.notes}
          onInvalid={blockedBy("notes", "Enter some notes.")}
          onChange={() => clearBrowserError("notes")}
          {...errorProps(`${base}-notes`, fieldErrors.notes)}
        />
        <FieldError id={`${base}-notes-error`} message={fieldErrors.notes} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${base}-date`}>Date</Label>
        <Input
          id={`${base}-date`}
          name="occurredAt"
          type="date"
          required
          defaultValue={values?.occurredAt ?? toDateInputValue(interaction.occurredAt)}
          onInvalid={blockedBy("occurredAt", "Enter a date.")}
          onChange={() => clearBrowserError("occurredAt")}
          {...errorProps(`${base}-date`, fieldErrors.occurredAt)}
        />
        <FieldError id={`${base}-date-error`} message={fieldErrors.occurredAt} />
      </div>
      <FormError message={state.formError} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
