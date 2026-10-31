import { type InvalidEvent, useState } from "react";

export type ValidatedField = HTMLInputElement | HTMLTextAreaElement;

// aria-invalid and aria-describedby are only set when the field has an error.
export function errorProps(id: string, message: string | undefined) {
  return message ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}

// The browser blocks the submit when a field fails its HTML constraints (empty notes, a
// half-typed date). preventDefault hides the native popup so the error shows next to the field
// like the API's errors, and the first invalid field gets focus as the popup would have given it.
// It reads validity instead of matching ":invalid", which in some DOMs runs checkValidity and
// fires this event again.
export function showInline(event: InvalidEvent<ValidatedField>): void {
  event.preventDefault();
  const fields = Array.from(event.currentTarget.form?.elements ?? []);
  const firstInvalid = fields.find(
    (field): field is ValidatedField =>
      (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) &&
      !field.validity.valid,
  );
  firstInvalid?.focus();
}

// Errors found by the browser's own checks, kept per field until the user changes the field.
export function useBrowserErrors<F extends string>() {
  const [browserErrors, setBrowserErrors] = useState<Partial<Record<F, string>>>({});

  function blockedBy(field: F, message: string) {
    return (event: InvalidEvent<ValidatedField>) => {
      showInline(event);
      setBrowserErrors((errors) => ({ ...errors, [field]: message }));
    };
  }

  function clearBrowserError(field: F) {
    if (browserErrors[field]) {
      setBrowserErrors((errors) => ({ ...errors, [field]: undefined }));
    }
  }

  function resetBrowserErrors() {
    setBrowserErrors({});
  }

  return { browserErrors, blockedBy, clearBrowserError, resetBrowserErrors };
}
