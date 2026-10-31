// Placeholder for an optional value that is not set.
export function MutedText({ children = "None" }: { children?: string }) {
  return <span className="text-muted">{children}</span>;
}
