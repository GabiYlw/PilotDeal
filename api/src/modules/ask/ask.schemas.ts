import { z } from "zod";
import type { InteractionType } from "../interactions/interactions.schemas.js";

export const ASK_QUESTION_MIN_LENGTH = 3;
export const ASK_QUESTION_MAX_LENGTH = 500;
export const ASK_DEFAULT_LIMIT = 5;
export const ASK_MAX_LIMIT = 10;

// limit must be a JSON integer (no string coercion), like numbers elsewhere in the API.
export const askRequestSchema = z.strictObject({
  question: z.string().trim().min(ASK_QUESTION_MIN_LENGTH).max(ASK_QUESTION_MAX_LENGTH),
  dealId: z.uuid().optional(),
  limit: z.number().int().min(1).max(ASK_MAX_LIMIT).default(ASK_DEFAULT_LIMIT),
});

export type AskInput = z.output<typeof askRequestSchema>;

export type AnsweredBy = "none"; // the next task adds "llm"

export interface AskSource {
  interactionId: string;
  dealId: string;
  dealTitle: string;
  companyName: string;
  type: InteractionType;
  occurredAt: Date;
  excerpt: string;
  similarity: number;
}

export interface AskResponse {
  answer: null;
  answeredBy: AnsweredBy;
  sources: AskSource[];
}

export interface InteractionSearchQuery {
  embedding: number[];
  dealId: string | null;
  maxDistance: number;
  limit: number;
}

export interface InteractionSearchRow {
  interactionId: string;
  dealId: string;
  dealTitle: string;
  companyName: string;
  type: InteractionType;
  notes: string;
  occurredAt: Date;
  similarity: number;
}
