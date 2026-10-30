"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FormError, Label, Select } from "@/components/ui/field";
import { STAGE_LABELS } from "@/lib/deal-display";
import { type FormState, type StageField, initialFormState } from "@/lib/form-state";
import { DEAL_STAGES, type DealStage } from "@/lib/types";

type StageAction = (
  state: FormState<StageField>,
  formData: FormData,
) => Promise<FormState<StageField>>;

export function StageForm({ stage, action }: { stage: DealStage; action: StageAction }) {
  const [state, formAction, pending] = useActionState(action, initialFormState<StageField>());
  const error = state.fieldErrors.stage;
  // After a failed update, keep the user's choice. React resets the form after the action and
  // ignores a new defaultValue on a mounted select, so the key remounts it with that value.
  const selected = state.values?.stage ?? stage;
  return (
    <form action={formAction} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="deal-stage">Stage</Label>
        <Select
          key={selected}
          id="deal-stage"
          name="stage"
          defaultValue={selected}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "deal-stage-error" : undefined}
        >
          {DEAL_STAGES.map((option) => (
            <option key={option} value={option}>
              {STAGE_LABELS[option]}
            </option>
          ))}
        </Select>
        <FieldError id="deal-stage-error" message={error} />
      </div>
      <FormError message={state.formError} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Updating..." : "Update stage"}
        </Button>
      </div>
    </form>
  );
}
