import { z } from "zod";
import { requiredText, strictBody } from "../../shared/validation.js";

export const INTERACTION_TYPES = ["EMAIL", "CALL", "MEETING", "NOTE"] as const;
export const interactionTypeSchema = z.enum(INTERACTION_TYPES, {
  error: `Type must be one of ${INTERACTION_TYPES.join(", ")}`,
});
export type InteractionType = z.output<typeof interactionTypeSchema>;

const notesSchema = requiredText("Notes", 5000);

const MIN_OCCURRED_AT = Date.UTC(1900, 0, 1);

// Date.now() runs at parse time (inside the refine), not at module load.
const occurredAtSchema = z.iso
  .datetime({ offset: true, error: "Enter a valid date and time with a time zone offset" })
  .transform((value) => new Date(value))
  .refine((date) => date.getTime() >= MIN_OCCURRED_AT, {
    error: "Date must be on or after 1900-01-01",
  })
  .refine((date) => date.getTime() <= Date.now(), {
    error: "Date cannot be in the future",
  });

export const createInteractionSchema = strictBody({
  type: interactionTypeSchema,
  notes: notesSchema,
  occurredAt: occurredAtSchema.optional(),
});

// dealId is deliberately absent: an interaction cannot be moved between deals.
export const updateInteractionSchema = strictBody({
  type: interactionTypeSchema.optional(),
  notes: notesSchema.optional(),
  occurredAt: occurredAtSchema.optional(),
}).refine((body) => Object.keys(body).length > 0, {
  message: "At least one field must be provided",
});

export type CreateInteractionInput = z.output<typeof createInteractionSchema>;
export type UpdateInteractionInput = z.output<typeof updateInteractionSchema>;

export interface Interaction {
  id: string;
  dealId: string;
  type: InteractionType;
  notes: string;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

// The part of an interaction that is needed to compute its embedding.
export interface EmbeddableInteraction {
  id: string;
  notes: string;
}
