import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

// Small building blocks shared by the sections. Same looks as web/src/components/ui/.

export function Container({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6", className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-card-border bg-surface p-6 shadow-card", className)}
      {...props}
    />
  );
}

export type BadgeVariant = "neutral" | "accent" | "accent-subtle" | "danger";

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  neutral: "bg-surface-hover text-muted",
  accent: "bg-accent text-accent-foreground",
  "accent-subtle": "bg-accent-subtle text-link",
  danger: "bg-danger-subtle text-danger",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: { variant?: BadgeVariant } & ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        BADGE_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

// Small uppercase label above a heading or a table, in Geist Mono.
export function Eyebrow({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "font-mono text-xs font-semibold tracking-wider text-link uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
}: {
  id: string;
  eyebrow: string;
  title: string;
  intro?: ReactNode;
}) {
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 id={id} className="text-3xl font-bold tracking-tight text-balance text-foreground">
        {title}
      </h2>
      {intro && <p className="text-base text-muted">{intro}</p>}
    </div>
  );
}

// A section of the page: labelled by its heading, offset for the sticky header, fades in once.
export function Section({
  id,
  labelledBy,
  className,
  children,
}: {
  id?: string;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      data-reveal=""
      className={cn("scroll-mt-20 py-16 sm:py-24", className)}
    >
      <Container>{children}</Container>
    </section>
  );
}

// Says plainly that the demo runs on sample data. Sits next to the demo buttons.
export function DemoNote({ className, ...props }: ComponentProps<"p">) {
  return <p className={cn("font-mono text-xs tracking-wide text-muted", className)} {...props} />;
}

// The canvas panel at the top of an "Under the hood" card.
export function IllustrationPanel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-xl border border-card-border bg-canvas p-4", className)}
      {...props}
    />
  );
}
