"use client";

import { useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FormError, Input, Label, Select } from "@/components/ui/field";
import { errorProps, useBrowserErrors } from "@/lib/browser-validation";
import { STAGE_LABELS } from "@/lib/deal-display";
import { type DealField, type FormState, initialFormState } from "@/lib/form-state";
import { DEAL_STAGES } from "@/lib/types";

export type CreateDealAction = (
  state: FormState<DealField>,
  formData: FormData,
) => Promise<FormState<DealField>>;

const VALUE_MESSAGE = "Enter a number of 0 or more with at most 2 decimals.";

// A successful create redirects to the new deal, so there is no success state to show.
export function DealCreateForm({
  action,
  onCancel,
}: {
  action: CreateDealAction;
  onCancel(): void;
}) {
  const [state, formAction, pending] = useActionState(action, initialFormState<DealField>());
  const { browserErrors, blockedBy, clearBrowserError, resetBrowserErrors } =
    useBrowserErrors<DealField>();
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const fieldErrors = { ...state.fieldErrors, ...browserErrors };
  const { values } = state;
  // The select needs a key: React ignores a new defaultValue on a mounted select.
  const stage = values?.stage ?? "LEAD";
  return (
    <form
      action={formAction}
      onSubmit={resetBrowserErrors}
      aria-label="New deal"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-deal-title">Title</Label>
        <Input
          ref={titleRef}
          id="new-deal-title"
          name="title"
          required
          defaultValue={values?.title ?? ""}
          onInvalid={blockedBy("title", "Enter a title.")}
          onChange={() => clearBrowserError("title")}
          {...errorProps("new-deal-title", fieldErrors.title)}
        />
        <FieldError id="new-deal-title-error" message={fieldErrors.title} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-deal-value">Value</Label>
        <Input
          id="new-deal-value"
          name="value"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          required
          defaultValue={values?.value ?? ""}
          onInvalid={blockedBy("value", VALUE_MESSAGE)}
          onChange={() => clearBrowserError("value")}
          {...errorProps("new-deal-value", fieldErrors.value)}
        />
        <FieldError id="new-deal-value-error" message={fieldErrors.value} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-deal-stage">Stage</Label>
        <Select
          key={stage}
          id="new-deal-stage"
          name="stage"
          defaultValue={stage}
          {...errorProps("new-deal-stage", fieldErrors.stage)}
        >
          {DEAL_STAGES.map((option) => (
            <option key={option} value={option}>
              {STAGE_LABELS[option]}
            </option>
          ))}
        </Select>
        <FieldError id="new-deal-stage-error" message={fieldErrors.stage} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="new-deal-date">Expected close date (optional)</Label>
        <Input
          id="new-deal-date"
          name="expectedCloseDate"
          type="date"
          defaultValue={values?.expectedCloseDate ?? ""}
          onInvalid={blockedBy("expectedCloseDate", "Enter a complete date or clear the field.")}
          onChange={() => clearBrowserError("expectedCloseDate")}
          {...errorProps("new-deal-date", fieldErrors.expectedCloseDate)}
        />
        <FieldError id="new-deal-date-error" message={fieldErrors.expectedCloseDate} />
      </div>
      <FormError message={state.formError} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creating..." : "Create deal"}
        </Button>
        <Button variant="secondary" size="sm" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
