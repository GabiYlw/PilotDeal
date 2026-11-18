import type { AskResponse, InteractionType } from "@/lib/types";
import answersJson from "./data/ask-answers.json";
import { daysAgo, SEED } from "./state";

// Ask the Pilot in the demo: no AI and no search. A few preset questions, each with the answer the
// real app gave when `npm --prefix api run demo:answers` asked it (citations included), shown as
// the API's /ask response so the dashboard's answer components render it unchanged.
// The sources describe the sample data as loaded, so editing or deleting a note in the demo does
// not change an answer that was given before.

interface StoredSource {
  label: string;
  interactionId: string;
  excerpt: string;
  similarity: number;
}

export interface StoredAnswer {
  question: string;
  answer: string;
  insufficientInformation: boolean;
  citedInteractionIds: string[];
  sources: StoredSource[];
}

const ANSWERS = (answersJson as { questions: StoredAnswer[] }).questions;

export const PRESET_QUESTIONS: readonly string[] = ANSWERS.map((answer) => answer.question);

interface SeededNote {
  dealId: string;
  dealTitle: string;
  companyName: string;
  type: InteractionType;
  daysAgo: number;
}

const SEEDED_NOTES = new Map<string, SeededNote>(
  SEED.companies.flatMap((company) =>
    company.deals.flatMap((deal) =>
      deal.interactions.map((interaction): [string, SeededNote] => [
        interaction.id,
        {
          dealId: deal.id,
          dealTitle: deal.title,
          companyName: company.name,
          type: interaction.type,
          daysAgo: interaction.daysAgo,
        },
      ]),
    ),
  ),
);

// null when the question is not one of the presets (the demo takes no free-text questions).
export function presetAnswer(question: string, loadedAt: Date): AskResponse | null {
  const stored = ANSWERS.find((answer) => answer.question === question);
  if (!stored) return null;
  return {
    answer: stored.answer,
    answeredBy: "llm",
    insufficientInformation: stored.insufficientInformation,
    citedInteractionIds: stored.citedInteractionIds,
    sources: stored.sources.flatMap((source) => {
      const note = SEEDED_NOTES.get(source.interactionId);
      if (!note) return [];
      return [
        {
          label: source.label,
          interactionId: source.interactionId,
          dealId: note.dealId,
          dealTitle: note.dealTitle,
          companyName: note.companyName,
          type: note.type,
          occurredAt: daysAgo(loadedAt, note.daysAgo),
          excerpt: source.excerpt,
          similarity: source.similarity,
        },
      ];
    }),
  };
}
