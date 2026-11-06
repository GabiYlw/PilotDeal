import type { ReactNode } from "react";

// A neutral confirmation. role="status" lets assistive technology announce it politely.
export function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-2xl border border-card-border bg-surface px-5 py-4 shadow-card text-sm text-foreground"
    >
      <span>{children}</span>
      {action}
    </div>
  );
}
