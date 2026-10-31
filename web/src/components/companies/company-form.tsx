"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { FieldError, FormError, Input, Label } from "@/components/ui/field";
import { errorProps, useBrowserErrors } from "@/lib/browser-validation";
import { type CompanyField, type FormState, initialFormState } from "@/lib/form-state";

export type CompanyAction = (
  state: FormState<CompanyField>,
  formData: FormData,
) => Promise<FormState<CompanyField>>;

interface CompanyFormProps {
  action: CompanyAction;
  // Values shown when there is no submitted value to restore (the saved company when editing).
  defaults?: Partial<Record<CompanyField, string>>;
  idPrefix: string;
  ariaLabel: string;
  submitLabel: string;
  pendingLabel: string;
  // Edit usage: a Cancel button, and a callback once the save worked.
  onCancel?(): void;
  onSaved?(): void;
  // Create usage: Cancel is a link.
  cancelHref?: string;
  autoFocus?: boolean;
}

// Shared by the create page and the edit mode of the details card.
export function CompanyForm({
  action,
  defaults,
  idPrefix,
  ariaLabel,
  submitLabel,
  pendingLabel,
  onCancel,
  onSaved,
  cancelHref,
  autoFocus = false,
}: CompanyFormProps) {
  const [state, formAction, pending] = useActionState(
    async (previous: FormState<CompanyField>, formData: FormData) => {
      const next = await action(previous, formData);
      // Re-enter the transition after the await so leaving edit mode commits with the new data.
      if (next.status === "success" && onSaved) startTransition(onSaved);
      return next;
    },
    initialFormState<CompanyField>(),
  );
  const { browserErrors, blockedBy, clearBrowserError, resetBrowserErrors } =
    useBrowserErrors<CompanyField>();
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) nameRef.current?.focus();
  }, [autoFocus]);

  const fieldErrors = { ...state.fieldErrors, ...browserErrors };
  const { values } = state;
  const name = `${idPrefix}-name`;
  const industry = `${idPrefix}-industry`;
  const website = `${idPrefix}-website`;
  return (
    <form
      action={formAction}
      onSubmit={resetBrowserErrors}
      aria-label={ariaLabel}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={name}>Name</Label>
        <Input
          ref={nameRef}
          id={name}
          name="name"
          required
          defaultValue={values?.name ?? defaults?.name ?? ""}
          onInvalid={blockedBy("name", "Enter a name.")}
          onChange={() => clearBrowserError("name")}
          {...errorProps(name, fieldErrors.name)}
        />
        <FieldError id={`${name}-error`} message={fieldErrors.name} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={industry}>Industry (optional)</Label>
        <Input
          id={industry}
          name="industry"
          defaultValue={values?.industry ?? defaults?.industry ?? ""}
          {...errorProps(industry, fieldErrors.industry)}
        />
        <FieldError id={`${industry}-error`} message={fieldErrors.industry} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={website}>Website (optional)</Label>
        <Input
          id={website}
          name="website"
          type="url"
          defaultValue={values?.website ?? defaults?.website ?? ""}
          onInvalid={blockedBy("website", "Enter a full URL starting with http:// or https://.")}
          onChange={() => clearBrowserError("website")}
          {...errorProps(website, fieldErrors.website)}
        />
        <FieldError id={`${website}-error`} message={fieldErrors.website} />
      </div>
      <FormError message={state.formError} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" size="sm" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        )}
        {cancelHref && (
          <ButtonLink variant="secondary" size="sm" href={cancelHref}>
            Cancel
          </ButtonLink>
        )}
      </div>
    </form>
  );
}
