import { Button, ButtonLink } from "@/components/ui/button";

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
}

// An enabled control is a link; a disabled one is a disabled button, so it is not focusable.
function PageControl({ label, href, enabled }: { label: string; href: string; enabled: boolean }) {
  if (!enabled) {
    return (
      <Button variant="secondary" size="sm" disabled>
        {label}
      </Button>
    );
  }
  return (
    <ButtonLink variant="secondary" size="sm" href={href}>
      {label}
    </ButtonLink>
  );
}

export function Pagination({ page, pageSize, total, basePath }: PaginationProps) {
  if (total <= pageSize && page === 1) {
    return null;
  }
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-4">
      <p className="text-sm text-muted">
        Showing {from}-{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        <PageControl label="Previous" href={`${basePath}?page=${page - 1}`} enabled={page > 1} />
        <PageControl
          label="Next"
          href={`${basePath}?page=${page + 1}`}
          enabled={page * pageSize < total}
        />
      </div>
    </nav>
  );
}
