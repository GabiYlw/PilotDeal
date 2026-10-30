import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "accent" | "success" | "warning" | "danger";

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: "border-border bg-surface text-muted",
  accent: "border-transparent bg-accent text-accent-foreground",
  success: "border-transparent bg-success-subtle text-success",
  warning: "border-transparent bg-warning-subtle text-warning",
  danger: "border-transparent bg-danger-subtle text-danger",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: { variant?: BadgeVariant } & ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
