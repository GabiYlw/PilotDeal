"use client";

import { useEffect, useRef, useState } from "react";
import { DeleteInteractionButton } from "@/components/deals/delete-interaction-button";
import {
  type EditInteractionAction,
  InteractionEditForm,
} from "@/components/deals/interaction-edit-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { INTERACTION_TYPE_LABELS } from "@/lib/deal-display";
import type { ActionState } from "@/lib/form-state";
import type { Interaction } from "@/lib/types";

export type { EditInteractionAction };
export type RemoveInteractionAction = (state: ActionState) => Promise<ActionState>;

export function InteractionItem({
  interaction,
  dateLabel,
  edit,
  remove,
}: {
  interaction: Interaction;
  // Formatted on the server, so the text is the same on every machine.
  dateLabel: string;
  edit: EditInteractionAction;
  remove: RemoveInteractionAction;
}) {
  const [editing, setEditing] = useState(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusToEdit = useRef(false);

  // The Edit button only exists again after the form has closed, so focus moves in an effect.
  useEffect(() => {
    if (!editing && returnFocusToEdit.current) {
      returnFocusToEdit.current = false;
      editButtonRef.current?.focus();
    }
  }, [editing]);

  function closeEditor() {
    returnFocusToEdit.current = true;
    setEditing(false);
  }

  if (editing) {
    return (
      <InteractionEditForm
        interaction={interaction}
        action={edit}
        onCancel={closeEditor}
        onSaved={closeEditor}
      />
    );
  }

  const summaryId = `interaction-${interaction.id}-summary`;
  const typeLabel = INTERACTION_TYPE_LABELS[interaction.type];
  return (
    <>
      <div id={summaryId} className="flex flex-wrap items-center gap-2">
        <Badge>{typeLabel}</Badge>
        <time dateTime={interaction.occurredAt} className="text-xs text-muted">
          {dateLabel}
        </time>
      </div>
      <p className="text-sm [overflow-wrap:anywhere] whitespace-pre-line text-foreground">
        {interaction.notes}
      </p>
      <div className="flex gap-1">
        <Button
          ref={editButtonRef}
          variant="ghost"
          size="sm"
          aria-describedby={summaryId}
          onClick={() => setEditing(true)}
        >
          Edit
        </Button>
        <DeleteInteractionButton
          action={remove}
          typeLabel={typeLabel}
          dateLabel={dateLabel}
          describedBy={summaryId}
        />
      </div>
    </>
  );
}
