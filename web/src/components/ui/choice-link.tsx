import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// A link shown as one option in a list of choices (the static demo's preset questions). Unlike
// ButtonLink its text wraps, so a long option fits on a phone. The selected one is marked with
// aria-current and a teal border, not by color alone. 44px tall below md, like Button.
export function ChoiceLink({
  selected = false,
  className,
  ...props
}: { selected?: boolean } & ComponentProps<typeof Link>) {
  return (
    <Link
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex min-h-11 items-center rounded-lg border px-4 py-2.5 text-left text-sm font-medium text-foreground transition-colors md:min-h-9 md:py-2",
        selected
          ? "border-accent bg-accent-subtle"
          : "border-border bg-surface hover:bg-surface-hover",
        className,
      )}
      {...props}
    />
  );
}
