// Helpers that turn raw form strings into API values. Kept out of the "use server" action files,
// which may only export async functions. Pure functions: no server-only import.

export function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// Empty or whitespace-only optional fields become null, which clears them in the API.
export function nullableText(value: string): string | null {
  return value.trim() === "" ? null : value;
}

// An empty value is left out. A non-numeric string is passed through so the API reports it.
export function toDealValue(raw: string): number | string | undefined {
  if (raw.trim() === "") return undefined;
  return Number.isFinite(Number(raw)) ? Number(raw) : raw;
}
