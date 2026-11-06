import type { ReactNode } from "react";
import { Breadcrumb, type BreadcrumbItem } from "@/components/ui/breadcrumb";
import { cn } from "@/lib/cn";

// Title on the left, breadcrumb and actions on the right. On a phone everything stacks in DOM
// order: breadcrumb, title, actions.
export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: BreadcrumbItem[];
}) {
  return (
    <header className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-x-6">
      {breadcrumb && (
        <div className="sm:col-start-2 sm:row-start-1 sm:justify-self-end">
          <Breadcrumb items={breadcrumb} />
        </div>
      )}
      <div className="flex min-w-0 flex-col gap-1.5 sm:col-start-1 sm:row-span-2 sm:row-start-1">
        <h1 className="text-3xl font-bold tracking-tight break-words text-foreground">{title}</h1>
        {description && <p className="text-base text-muted">{description}</p>}
      </div>
      {actions && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 sm:col-start-2 sm:justify-self-end",
            breadcrumb ? "sm:row-start-2" : "sm:row-start-1",
          )}
        >
          {actions}
        </div>
      )}
    </header>
  );
}
