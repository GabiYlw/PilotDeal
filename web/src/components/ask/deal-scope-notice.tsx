import { ButtonLink } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { DEAL_NOT_FOUND_MESSAGE } from "@/lib/messages";

// title null means the scope deal does not exist (deleted, or a malformed id in the URL).
export function DealScopeNotice({ title, clearHref }: { title: string | null; clearHref: string }) {
  return (
    <Notice
      action={
        <ButtonLink href={clearHref} variant="ghost" size="sm">
          Clear scope
        </ButtonLink>
      }
    >
      {title === null ? DEAL_NOT_FOUND_MESSAGE : `Scoped to: ${title}`}
    </Notice>
  );
}
