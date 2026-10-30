import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { INTERACTION_TYPE_LABELS } from "@/lib/deal-display";
import { formatDate } from "@/lib/format";
import type { Interaction } from "@/lib/types";

function TimelineItem({ interaction }: { interaction: Interaction }) {
  return (
    <li className="flex flex-col gap-1.5 border-b border-border pb-4 last:border-b-0 last:pb-0">
      <div className="flex items-center gap-2">
        <Badge>{INTERACTION_TYPE_LABELS[interaction.type]}</Badge>
        <time dateTime={interaction.occurredAt} className="text-xs text-muted">
          {formatDate(interaction.occurredAt)}
        </time>
      </div>
      <p className="text-sm break-words whitespace-pre-line text-foreground">
        {interaction.notes}
      </p>
    </li>
  );
}

export function InteractionTimeline({
  interactions,
  total,
}: {
  interactions: Interaction[];
  total: number;
}) {
  if (interactions.length === 0) {
    return <EmptyState title="No interactions yet" />;
  }
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-4">
        {interactions.map((interaction) => (
          <TimelineItem key={interaction.id} interaction={interaction} />
        ))}
      </ol>
      {total > interactions.length && (
        <p className="text-sm text-muted">
          Showing the {interactions.length} most recent of {total} interactions.
        </p>
      )}
    </div>
  );
}
