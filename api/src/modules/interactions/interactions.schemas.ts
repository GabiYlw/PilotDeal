import { z } from "zod";

export const INTERACTION_TYPES = ["EMAIL", "CALL", "MEETING", "NOTE"] as const;
export const interactionTypeSchema = z.enum(INTERACTION_TYPES);
export type InteractionType = z.output<typeof interactionTypeSchema>;

const notesSchema = z.string().trim().min(1).max(5000);

const MIN_OCCURRED_AT = Date.UTC(1900, 0, 1);

// Date.now() runs at parse time (inside the refine), not at module load.
const occurredAtSchema = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .refine((date) => date.getTime() >= MIN_OCCURRED_AT, {
    message: "occurredAt must be on or after 1900-01-01",
  })
  .refine((date) => date.getTime() <= Date.now(), {
    message: "occurredAt cannot be in the future",
  });

export const createInteractionSchema = z.strictObject({
  type: interactionTypeSchema,
  notes: notesSchema,
  occurredAt: occurredAtSchema.optional(),
});

// dealId is deliberately absent: an interaction cannot be moved between deals.
export const updateInteractionSchema = z
  .strictObject({
    type: interactionTypeSchema.optional(),
    notes: notesSchema.optional(),
    occurredAt: occurredAtSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });

export const dealIdParamsSchema = z.object({ dealId: z.uuid() });

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
