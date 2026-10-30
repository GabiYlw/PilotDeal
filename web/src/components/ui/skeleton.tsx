import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// A pulsing placeholder block. Size it with className (for example "h-4 w-32").
export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-surface-hover", className)}
      {...props}
    />
  );
}
