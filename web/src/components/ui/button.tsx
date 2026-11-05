import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md border font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary: "border-border bg-surface text-foreground hover:bg-surface-hover",
  ghost:
    "border-transparent bg-transparent text-muted hover:bg-surface-hover hover:text-foreground",
  // Only for the confirm button of a destructive action.
  danger: "border-transparent bg-danger text-danger-foreground hover:bg-danger-hover",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-xs",
  md: "h-8 px-3 text-sm",
};

interface ButtonStyle {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

function buttonClasses({ variant = "primary", size = "md" }: ButtonStyle): string {
  return cn(BASE, VARIANTS[variant], SIZES[size]);
}

// type defaults to "button" so a Button inside a form only submits when asked to.
export function Button({
  variant,
  size,
  type = "button",
  className,
  ...props
}: ButtonStyle & ComponentProps<"button">) {
  return (
    <button type={type} className={cn(buttonClasses({ variant, size }), className)} {...props} />
  );
}

// A link that looks like a Button, for navigation actions.
export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ButtonStyle & ComponentProps<typeof Link>) {
  return <Link className={cn(buttonClasses({ variant, size }), className)} {...props} />;
}
