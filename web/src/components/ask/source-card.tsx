import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { RelevanceIndicator } from "@/components/ui/relevance-indicator";
import { TextLink } from "@/components/ui/text-link";
import { relevanceLevel } from "@/lib/ask-display";
import { INTERACTION_TYPE_LABELS } from "@/lib/deal-display";
import { formatDate } from "@/lib/format";
import type { AskSource } from "@/lib/types";

// The id lets [S1] links in the answer jump here. The "Cited" badge repeats the highlight in
// text, so the state is not conveyed by the border color alone.
export function SourceCard({ source, cited }: { source: AskSource; cited: boolean }) {
  return (
    <Card
      id={`source-${source.label}`}
      highlighted={cited}
      className="flex scroll-mt-6 flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-foreground">{source.label}</span>
        {cited && <Badge variant="accent">Cited</Badge>}
        <Badge>{INTERACTION_TYPE_LABELS[source.type]}</Badge>
        <time dateTime={source.occurredAt} className="text-xs text-muted">
          {formatDate(source.occurredAt)}
        </time>
      </div>
      <p className="text-sm text-muted">
        {source.companyName} ·{" "}
        <TextLink href={`/deals/${source.dealId}`}>{source.dealTitle}</TextLink>
      </p>
      <p className="text-sm break-words whitespace-pre-line text-foreground">{source.excerpt}</p>
      <RelevanceIndicator level={relevanceLevel(source.similarity)} />
    </Card>
  );
}
