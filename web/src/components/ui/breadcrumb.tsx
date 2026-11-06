import { ChevronRight } from "lucide-react";
import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  // The last item is the current page and has no href.
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-1 text-xs text-muted">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-1">
            {index > 0 && <ChevronRight aria-hidden="true" className="size-3.5 shrink-0" />}
            {item.href ? (
              <Link
                href={item.href}
                className="rounded-sm font-medium text-link underline-offset-4 hover:underline"
              >
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="max-w-64 truncate text-foreground">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
