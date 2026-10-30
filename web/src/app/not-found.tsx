import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

// Deals, Companies and Ask are linked from the sidebar before they exist, so this page says so.
export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl">
      <EmptyState
        title="Page not found"
        description="This page does not exist or has not been built yet."
        action={
          <ButtonLink href="/" variant="secondary">
            Back to home
          </ButtonLink>
        }
      />
    </div>
  );
}
