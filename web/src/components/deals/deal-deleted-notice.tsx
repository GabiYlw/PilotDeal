import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { dealDeletedMessage } from "@/lib/deal-deleted";

// Reads the search param, so it must be rendered inside <Suspense>.
export async function DealDeletedNotice({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const message = dealDeletedMessage((await searchParams).deleted);
  if (!message) return null;
  return (
    <Notice
      action={
        <ButtonLink href="/deals" variant="ghost" size="sm" replace scroll={false}>
          Dismiss
        </ButtonLink>
      }
    >
      {message}
    </Notice>
  );
}
