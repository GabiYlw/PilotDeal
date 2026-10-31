import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// highlighted marks a selected or cited card. The border color is chosen here, not through
// className, because cn does not resolve conflicting Tailwind classes.
export function Card({
  highlighted = false,
  className,
  ...props
}: { highlighted?: boolean } & ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-surface p-5",
        highlighted ? "border-accent" : "border-border",
        className,
      )}
      {...props}
    />
  );
}

// level keeps the page outline without skipped levels: 2 when the card sits directly under the
// page's h1, 3 (the default) when it sits under a section heading.
export function CardTitle({
  level = 3,
  className,
  ...props
}: { level?: 2 | 3 } & ComponentProps<"h3">) {
  const Heading = level === 2 ? "h2" : "h3";
  return <Heading className={cn("text-sm font-medium text-foreground", className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm leading-relaxed text-muted", className)} {...props} />;
}
