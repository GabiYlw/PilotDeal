import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// A simple browser window around a screenshot: three dots and an optional address pill.
export function BrowserFrame({
  address,
  className,
  children,
}: {
  address?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-card-border bg-surface shadow-raised",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="flex items-center gap-3 border-b border-card-border bg-canvas px-4 py-2.5"
      >
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
          <span className="size-2.5 rounded-full bg-border-strong" />
        </span>
        {address && (
          <span className="min-w-0 truncate rounded-full bg-surface px-3 py-0.5 font-mono text-xs text-muted">
            {address}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
