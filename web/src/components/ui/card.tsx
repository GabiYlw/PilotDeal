import type { ComponentProps, ReactNode } from "react";
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
        "rounded-2xl border bg-surface p-6 shadow-card",
        highlighted ? "border-accent" : "border-card-border",
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
  return (
    <Heading className={cn("text-base font-semibold text-foreground", className)} {...props} />
  );
}

export function CardDescription({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("text-sm leading-relaxed text-muted", className)} {...props} />;
}

// Title on the left, the card's own actions on the right. min-h keeps the row the same height
// whether or not an action is shown.
export function CardHeader({
  title,
  level,
  actions,
}: {
  title: ReactNode;
  level?: 2 | 3;
  actions?: ReactNode;
}) {
  return (
    <div className="flex min-h-7 flex-wrap items-center justify-between gap-3">
      <CardTitle level={level}>{title}</CardTitle>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
