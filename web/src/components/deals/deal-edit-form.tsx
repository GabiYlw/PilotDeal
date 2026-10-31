"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FormError, Input, Label } from "@/components/ui/field";
import { errorProps, useBrowserErrors } from "@/lib/browser-validation";
import { type DealEditField, type FormState, initialFormState } from "@/lib/form-state";
import type { Deal } from "@/lib/types";

export type EditDealAction = (
  state: FormState<DealEditField>,
  formData: FormData,
) => Promise<FormState<DealEditField>>;

const VALUE_MESSAGE = "Enter a number of 0 or more with at most 2 decimals.";

// Not keyed: React resets the submitted form after the action and the inputs then show the
// revalidated deal, while a stage update elsewhere on the page leaves a half-typed edit alone.
export function DealEditForm({ deal, action }: { deal: Deal; action: EditDealAction }) {
  const [state, formAction, pending] = useActionState(action, initialFormState<DealEditField>());
  const { browserErrors, blockedBy, clearBrowserError, resetBrowserErrors } =
    useBrowserErrors<DealEditField>();

  const fieldErrors = { ...state.fieldErrors, ...browserErrors };
  const { values } = state;
  return (
    <form
      action={formAction}
      onSubmit={resetBrowserErrors}
      aria-label="Edit deal"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="deal-edit-title">Title</Label>
        <Input
          id="deal-edit-title"
          name="title"
          required
          defaultValue={values?.title ?? deal.title}
          onInvalid={blockedBy("title", "Enter a title.")}
          onChange={() => clearBrowserError("title")}
          {...errorProps("deal-edit-title", fieldErrors.title)}
        />
        <FieldError id="deal-edit-title-error" message={fieldErrors.title} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="deal-edit-value">Value</Label>
        <Input
          id="deal-edit-value"
          name="value"
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          required
          defaultValue={values?.value ?? String(deal.value)}
          onInvalid={blockedBy("value", VALUE_MESSAGE)}
          onChange={() => clearBrowserError("value")}
          {...errorProps("deal-edit-value", fieldErrors.value)}
        />
        <FieldError id="deal-edit-value-error" message={fieldErrors.value} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="deal-edit-date">Expected close date (optional)</Label>
        <Input
          id="deal-edit-date"
          name="expectedCloseDate"
          type="date"
          defaultValue={values?.expectedCloseDate ?? deal.expectedCloseDate ?? ""}
          onInvalid={blockedBy("expectedCloseDate", "Enter a complete date or clear the field.")}
          onChange={() => clearBrowserError("expectedCloseDate")}
          {...errorProps("deal-edit-date", fieldErrors.expectedCloseDate)}
        />
        <FieldError id="deal-edit-date-error" message={fieldErrors.expectedCloseDate} />
      </div>
      <FormError message={state.formError} />
      {state.status === "success" && (
        <p role="status" className="text-xs text-muted">
          Deal saved.
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
