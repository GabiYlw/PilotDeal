import type { InteractionType } from "../modules/interactions/interactions.schemas.js";

export interface AnswerSource {
  label: string;
  dealTitle: string;
  companyName: string;
  type: InteractionType;
  occurredAt: Date;
  notes: string;
}

export interface AnswerDraft {
  answer: string;
  citedLabels: string[];
  insufficientInformation: boolean;
}

// null = no answer (no generator configured, or generation failed and was already logged).
export type GeneratedAnswer = AnswerDraft | null;

// Strategy interface: callers never know which generator they use.
export interface AnswerGenerator {
  generate(question: string, sources: AnswerSource[]): Promise<GeneratedAnswer>;
}

// Used when no API key is configured: /ask then returns sources only.
export class NoAnswerGenerator implements AnswerGenerator {
  generate(): Promise<GeneratedAnswer> {
    return Promise.resolve(null);
  }
}
