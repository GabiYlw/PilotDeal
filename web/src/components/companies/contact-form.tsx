"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FormError, Input, Label } from "@/components/ui/field";
import { errorProps, useBrowserErrors } from "@/lib/browser-validation";
import { type ContactField, type FormState, initialFormState } from "@/lib/form-state";
import { CHANGES_FROM_OWN_ADD, usePageChanges } from "@/lib/use-page-changes";

export type ContactAction = (
  state: FormState<ContactField>,
  formData: FormData,
) => Promise<FormState<ContactField>>;

interface ContactFormProps {
  action: ContactAction;
  defaults?: Partial<Record<ContactField, string>>;
  idPrefix: string;
  ariaLabel: string;
  submitLabel: string;
  pendingLabel: string;
  onCancel?(): void;
  onSaved?(): void;
  // Add usage: confirms "Contact added." until the contacts change again (see
  // lib/page-version.ts). Without it the form shows no success message.
  pageVersion?: string;
  autoFocus?: boolean;
}

// Shared by the add form of the Contacts card and the inline edit form of a contact.
export function ContactForm({
  action,
  defaults,
  idPrefix,
  ariaLabel,
  submitLabel,
  pendingLabel,
  onCancel,
  onSaved,
  pageVersion,
  autoFocus = false,
}: ContactFormProps) {
  const [state, formAction, pending] = useActionState(
    async (previous: FormState<ContactField>, formData: FormData) => {
      const next = await action(previous, formData);
      if (next.status === "success" && onSaved) startTransition(onSaved);
      return next;
    },
    initialFormState<ContactField>(),
  );
  const { browserErrors, blockedBy, clearBrowserError, resetBrowserErrors } =
    useBrowserErrors<ContactField>();
  const { changes, resetChanges } = usePageChanges(pageVersion ?? "");
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) nameRef.current?.focus();
  }, [autoFocus]);

  // onSubmit only fires once every field passes the browser's checks.
  function handleSubmit() {
    resetBrowserErrors();
    resetChanges();
  }

  const fieldErrors = { ...state.fieldErrors, ...browserErrors };
  const { values } = state;
  const showAdded =
    pageVersion !== undefined && state.status === "success" && changes <= CHANGES_FROM_OWN_ADD;
  const name = `${idPrefix}-name`;
  const email = `${idPrefix}-email`;
  const phone = `${idPrefix}-phone`;
  const role = `${idPrefix}-role`;
  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
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
        <Label htmlFor={email}>Email (optional)</Label>
        <Input
          id={email}
          name="email"
          type="email"
          defaultValue={values?.email ?? defaults?.email ?? ""}
          onInvalid={blockedBy("email", "Enter a valid email address.")}
          onChange={() => clearBrowserError("email")}
          {...errorProps(email, fieldErrors.email)}
        />
        <FieldError id={`${email}-error`} message={fieldErrors.email} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={phone}>Phone (optional)</Label>
        <Input
          id={phone}
          name="phone"
          type="tel"
          defaultValue={values?.phone ?? defaults?.phone ?? ""}
          {...errorProps(phone, fieldErrors.phone)}
        />
        <FieldError id={`${phone}-error`} message={fieldErrors.phone} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={role}>Role (optional)</Label>
        <Input
          id={role}
          name="role"
          defaultValue={values?.role ?? defaults?.role ?? ""}
          {...errorProps(role, fieldErrors.role)}
        />
        <FieldError id={`${role}-error`} message={fieldErrors.role} />
      </div>
      <FormError message={state.formError} />
      {showAdded && (
        <p role="status" className="text-xs text-muted">
          Contact added.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="secondary" size="sm" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
