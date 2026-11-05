import { z } from "zod";
import { strictBody } from "../../shared/validation.js";
import type { InteractionType } from "../interactions/interactions.schemas.js";

export const ASK_QUESTION_MIN_LENGTH = 3;
export const ASK_QUESTION_MAX_LENGTH = 500;
export const ASK_DEFAULT_LIMIT = 5;
export const ASK_MAX_LIMIT = 10;

// limit must be a JSON integer (no string coercion), like numbers elsewhere in the API.
const LIMIT_ERROR = `Limit must be a whole number from 1 to ${ASK_MAX_LIMIT}`;

export const askRequestSchema = strictBody({
  question: z
    .string({
      error: (issue) =>
        issue.input === undefined ? "Question is required" : "Question must be text",
    })
    .trim()
    .min(ASK_QUESTION_MIN_LENGTH, {
      error: `Question must be at least ${ASK_QUESTION_MIN_LENGTH} characters`,
    })
    .max(ASK_QUESTION_MAX_LENGTH, {
      error: `Question must be at most ${ASK_QUESTION_MAX_LENGTH} characters`,
    }),
  dealId: z.uuid({ error: "dealId must be a valid UUID" }).optional(),
  limit: z
    .number({ error: LIMIT_ERROR })
    .int({ error: LIMIT_ERROR })
    .min(1, { error: LIMIT_ERROR })
    .max(ASK_MAX_LIMIT, { error: LIMIT_ERROR })
    .default(ASK_DEFAULT_LIMIT),
});

export type AskInput = z.output<typeof askRequestSchema>;

export type AnsweredBy = "llm" | "none";

export interface AskSource {
  label: string;
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
  answer: string | null;
  answeredBy: AnsweredBy;
  insufficientInformation: boolean;
  citedInteractionIds: string[];
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
