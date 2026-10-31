// aria-invalid and aria-describedby are only set when the field has an error. Kept apart from
// browser-validation.ts (which uses React state) so Server Components can import it.
export function errorProps(id: string, message: string | undefined) {
  return message ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {};
}
