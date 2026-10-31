import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { companyDeletedMessage } from "@/lib/company-deleted";

// Reads the search param, so it must be rendered inside <Suspense>.
export async function CompanyDeletedNotice({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const message = companyDeletedMessage((await searchParams).deleted);
  if (!message) return null;
  return (
    <Notice
      action={
        <ButtonLink href="/companies" variant="ghost" size="sm" replace scroll={false}>
          Dismiss
        </ButtonLink>
      }
    >
      {message}
    </Notice>
  );
}
