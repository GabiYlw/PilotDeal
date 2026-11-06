import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function DescriptionList({ className, ...props }: ComponentProps<"dl">) {
  return <dl className={cn("flex flex-col gap-3", className)} {...props} />;
}

export function DescriptionItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-sm text-muted">{term}</dt>
      <dd className="min-w-0 text-right text-sm [overflow-wrap:anywhere] text-foreground">
        {children}
      </dd>
    </div>
  );
}
