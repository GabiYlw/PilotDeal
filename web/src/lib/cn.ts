// Joins class names and drops falsy entries. It does not resolve conflicting Tailwind classes,
// so a className passed to a ui component should add layout (margins, width), not restyle it.
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
