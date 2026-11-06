import type { ReactNode } from "react";

// The home page headline: a large card with the page title, description, actions and footer.
export function Banner({
  title,
  description,
  actions,
  footer,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <header className="flex flex-col items-start gap-5 rounded-2xl border border-card-border bg-surface p-6 text-foreground shadow-card sm:p-10 md:p-12">
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance md:text-5xl">
        {title}
      </h1>
      {description && (
        <p className="max-w-xl text-base leading-relaxed text-muted">{description}</p>
      )}
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      {footer}
    </header>
  );
}
