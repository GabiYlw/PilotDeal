"use client";

import { type InvalidEvent, useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FormError, Input, Label, Select, Textarea } from "@/components/ui/field";
import { INTERACTION_TYPE_LABELS } from "@/lib/deal-display";
import { type FormState, type InteractionField, initialFormState } from "@/lib/form-state";
import { INTERACTION_TYPES } from "@/lib/types";

type InteractionAction = (
  state: FormState<InteractionField>,
  formData: FormData,
) => Promise<FormState<InteractionField>>;

type BrowserErrors = Partial<Record<InteractionField, string>>;

// aria-invalid and aria-describedby are only set when the field has an error.
function errorProps(id: string, message: string | undefined) {
  return message ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}

// The browser blocks the submit when a field fails its HTML constraints (empty notes, a
// half-typed date). preventDefault hides the native popup so the error shows next to the field
// like the API's errors, and the first invalid field gets focus as the popup would have given it.
// It reads validity instead of matching ":invalid", which in some DOMs runs checkValidity and
// fires this event again.
type ValidatedField = HTMLInputElement | HTMLTextAreaElement;

function showInline(event: InvalidEvent<ValidatedField>): void {
  event.preventDefault();
  const fields = Array.from(event.currentTarget.form?.elements ?? []);
  const firstInvalid = fields.find(
    (field): field is ValidatedField =>
      (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) &&
      !field.validity.valid,
  );
  firstInvalid?.focus();
}

export function InteractionForm({
  action,
  dealUpdatedAt,
}: {
  action: InteractionAction;
  // Changes when the deal itself changes (a stage update), not when an interaction is added.
  dealUpdatedAt: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialFormState<InteractionField>(),
  );
  const [browserErrors, setBrowserErrors] = useState<BrowserErrors>({});
  const [submittedAt, setSubmittedAt] = useState(dealUpdatedAt);

  function blockedBy(field: InteractionField, message: string) {
    return (event: InvalidEvent<ValidatedField>) => {
      showInline(event);
      setBrowserErrors((errors) => ({ ...errors, [field]: message }));
    };
  }

  function clearBrowserError(field: InteractionField) {
    if (browserErrors[field]) {
      setBrowserErrors((errors) => ({ ...errors, [field]: undefined }));
    }
  }

  // onSubmit only fires once every field passes the browser's checks.
  function handleSubmit() {
    setBrowserErrors({});
    setSubmittedAt(dealUpdatedAt);
  }

  const fieldErrors: BrowserErrors = { ...state.fieldErrors, ...browserErrors };
  const { values } = state;
  // After an error the fields keep the submitted values; after a success (no values) the form
  // reset clears them. The select needs a key: React ignores a new defaultValue on a mounted select.
  const type = values?.type ?? "NOTE";
  // The message belongs to that submit: once the page shows newer deal data for another reason
  // (a stage update), it no longer describes what the user just did.
  const showAdded = state.status === "success" && submittedAt === dealUpdatedAt;
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
