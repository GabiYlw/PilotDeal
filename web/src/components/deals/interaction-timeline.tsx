import {
  type EditInteractionAction,
  InteractionItem,
  type RemoveInteractionAction,
} from "@/components/deals/interaction-item";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import type { Interaction } from "@/lib/types";

export interface InteractionItemActions {
  edit: EditInteractionAction;
  remove: RemoveInteractionAction;
}

export function InteractionTimeline({
  interactions,
  total,
  actionsFor,
}: {
  interactions: Interaction[];
  total: number;
  // Binds the Server Actions for one interaction. Called on the server, so the timeline does not
  // import the actions file.
  actionsFor: (interaction: Interaction) => InteractionItemActions;
}) {
  if (interactions.length === 0) {
    return <EmptyState title="No interactions yet" />;
  }
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-4">
        {interactions.map((interaction) => (
          <li
            key={interaction.id}
            className="flex flex-col gap-1.5 border-b border-border pb-4 last:border-b-0 last:pb-0"
          >
            <InteractionItem
              interaction={interaction}
              dateLabel={formatDate(interaction.occurredAt)}
              {...actionsFor(interaction)}
            />
          </li>
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
