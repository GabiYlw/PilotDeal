// Interaction types as plain constants and types, with no zod, for the same reason as
// deals/deal-stages.ts. interactions.schemas.ts builds its zod schema from these and re-exports them.
export const INTERACTION_TYPES = ["EMAIL", "CALL", "MEETING", "NOTE"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];
