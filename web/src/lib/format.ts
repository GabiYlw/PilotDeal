const WHOLE = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const CENTS = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// No currency symbol: the data model has no currency.
export function formatValue(value: number): string {
  return (Number.isInteger(value) ? WHOLE : CENTS).format(value);
}

// Always UTC, on the server: the same input gives the same text on every machine and there is no
// hydration mismatch. A timestamp shows its UTC calendar day, which can differ from the user's
// local day near midnight. That is accepted for a single-user app.
const DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

// Accepts YYYY-MM-DD (read as UTC midnight, like the API) or a full ISO timestamp.
export function formatDate(value: string): string {
  return DATE.format(new Date(DATE_ONLY.test(value) ? `${value}T00:00:00.000Z` : value));
}

// The UTC day of a timestamp (YYYY-MM-DD), the same day formatDate shows. It does not depend on
// the browser's time zone, so it is safe in Client Components.
export function toDateInputValue(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
