"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FormError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { errorProps, useBrowserErrors } from "@/lib/browser-validation";
import { INTERACTION_TYPE_LABELS } from "@/lib/deal-display";
import { type FormState, type InteractionField, initialFormState } from "@/lib/form-state";
import { INTERACTION_TYPES } from "@/lib/types";
import { CHANGES_FROM_OWN_ADD, usePageChanges } from "@/lib/use-page-changes";

type InteractionAction = (
  state: FormState<InteractionField>,
  formData: FormData,
) => Promise<FormState<InteractionField>>;

export function InteractionForm({
  action,
  pageVersion,
}: {
  action: InteractionAction;
  // Changes whenever the data on the page changes: a stage update, an added, edited or deleted
  // interaction (see lib/page-version.ts).
  pageVersion: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState<InteractionField>());
  const { browserErrors, blockedBy, clearBrowserError, resetBrowserErrors } =
    useBrowserErrors<InteractionField>();
  const { changes, resetChanges } = usePageChanges(pageVersion);

  // onSubmit only fires once every field passes the browser's checks.
  function handleSubmit() {
    resetBrowserErrors();
    resetChanges();
  }

  const fieldErrors = { ...state.fieldErrors, ...browserErrors };
  const { values } = state;
  // After an error the fields keep the submitted values; after a success (no values) the form
  // reset clears them. The select needs a key: React ignores a new defaultValue on a mounted select.
  const type = values?.type ?? "NOTE";
  const showAdded = state.status === "success" && changes <= CHANGES_FROM_OWN_ADD;
  return (
    <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="interaction-type">Type</Label>
        <Select
          key={type}
          id="interaction-type"
          name="type"
          defaultValue={type}
          {...errorProps("interaction-type", fieldErrors.type)}
        >
          {INTERACTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {INTERACTION_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        <FieldError id="interaction-type-error" message={fieldErrors.type} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="interaction-notes">Notes</Label>
        <Textarea
          id="interaction-notes"
          name="notes"
          required
          defaultValue={values?.notes}
          onInvalid={blockedBy("notes", "Enter some notes.")}
          onChange={() => clearBrowserError("notes")}
          {...errorProps("interaction-notes", fieldErrors.notes)}
        />
        <FieldError id="interaction-notes-error" message={fieldErrors.notes} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="interaction-date">Date (optional)</Label>
        <Input
          id="interaction-date"
          name="occurredAt"
          type="date"
          defaultValue={values?.occurredAt}
          onInvalid={blockedBy("occurredAt", "Enter a complete date or clear the field.")}
          onChange={() => clearBrowserError("occurredAt")}
          {...errorProps("interaction-date", fieldErrors.occurredAt)}
        />
        <FieldError id="interaction-date-error" message={fieldErrors.occurredAt} />
      </div>
      <FormError message={state.formError} />
      {showAdded && (
        <p role="status" className="text-xs text-muted">
          Interaction added.
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Adding..." : "Add interaction"}
        </Button>
      </div>
    </form>
  );
}
