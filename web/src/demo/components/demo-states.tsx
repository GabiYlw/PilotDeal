import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Notice } from "@/components/ui/notice";

// Small pieces shared by the demo's pages.

export const DEMO_LABEL = "Demo · sample data";

// Under the logo in the sidebar, on every demo page.
export function DemoLabel() {
  return (
    <p className="md:px-1">
      <Badge variant="accent-subtle">{DEMO_LABEL}</Badge>
    </p>
  );
}

// In the home page banner, where the real app shows the API status (HealthBadge): same badge with a
// dot, but neutral, since there is no API to report on.
export function DemoStatus() {
  return (
    <Badge role="status" variant="neutral">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      Sample data · changes are kept until you reload
    </Badge>
  );
}

// The page of a client or deal deleted in this visit. The real app shows "not found"; the demo
// knows why it is gone and that a reload brings it back.
export function DeletedInDemo({ what, listHref }: { what: "client" | "deal"; listHref: string }) {
  return (
    <div className="mx-auto max-w-xl">
      <EmptyState
        title={`This ${what} was deleted`}
        description="Reload the page to start over with the sample data."
        action={
          <ButtonLink href={listHref} variant="secondary">
            Back to the list
          </ButtonLink>
        }
      />
    </div>
  );
}

// The "Deal deleted." / "Client deleted." notice the list pages show after a delete.
export function DeletedNotice({ message, dismissHref }: { message: string; dismissHref: string }) {
  return (
    <Notice
      action={
        <ButtonLink href={dismissHref} variant="ghost" size="sm" replace scroll={false}>
          Dismiss
        </ButtonLink>
      }
    >
      {message}
    </Notice>
  );
}
