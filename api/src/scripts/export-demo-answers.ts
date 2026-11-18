import "dotenv/config";
import type { AskResponse } from "../modules/ask/ask.schemas.js";
import { demoInteractions, writeDemoJson } from "./demo-data.js";

// Asks the running API the static demo's preset questions and writes the answers, with their
// citations, to web/src/demo/data/ask-answers.json. The demo never calls an AI: it shows these.
//
// Needs the real app: the database seeded (npm run seed), the API running (npm run dev) and
// ANTHROPIC_API_KEY set in api/.env. API_URL defaults to http://localhost:3001.
// Run it again whenever the seed data or the questions change.

const QUESTIONS = [
  "Which customers are worried about price or budget?",
  "Is a competitor involved in any deal?",
  "Which deals are waiting on a contract?",
  "Why did we lose a deal?",
  "What does Northwind Logistics want changed in the contract?",
];

const API_URL = (process.env.API_URL ?? "http://localhost:3001").replace(/\/+$/, "");

type ApiSource = AskResponse["sources"][number];

async function ask(question: string): Promise<AskResponse> {
  const response = await fetch(`${API_URL}/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  if (!response.ok) {
    throw new Error(`POST /ask answered ${response.status}: ${await response.text()}`);
  }
  return (await response.json()) as AskResponse;
}

// The API's ids are database UUIDs; the demo uses ids derived from the seed. A source is matched to
// its seeded interaction by deal, client and the start of its notes (the excerpt).
function toDemoId(source: ApiSource, interactions: ReturnType<typeof demoInteractions>): string {
  const match = interactions.find(
    (interaction) =>
      interaction.dealTitle === source.dealTitle &&
      interaction.companyName === source.companyName &&
      interaction.notes.startsWith(source.excerpt),
  );
  if (!match) {
    throw new Error(
      `No seeded interaction matches the source "${source.excerpt}". Reseed the database (npm run seed) so it matches prisma/seed-data.ts.`,
    );
  }
  return match.id;
}

async function exportDemoAnswers(): Promise<void> {
  const interactions = demoInteractions();
  const answers = [];
  for (const question of QUESTIONS) {
    const response = await ask(question);
    if (response.answeredBy !== "llm" || response.answer === null) {
      throw new Error(
        `The API answered "${question}" without AI. Set ANTHROPIC_API_KEY in api/.env and restart the API.`,
      );
    }
    const ids = new Map(
      response.sources.map((source) => [source.interactionId, toDemoId(source, interactions)]),
    );
    answers.push({
      question,
      answer: response.answer,
      insufficientInformation: response.insufficientInformation,
      citedInteractionIds: response.citedInteractionIds.map((id) => ids.get(id) ?? id),
      sources: response.sources.map((source) => ({
        label: source.label,
        interactionId: ids.get(source.interactionId),
        excerpt: source.excerpt,
        similarity: source.similarity,
      })),
    });
    console.log(`Answered: ${question}`);
  }
  const path = writeDemoJson("ask-answers.json", { questions: answers });
  console.log(`Wrote ${path}`);
}

exportDemoAnswers().catch((error: unknown) => {
  console.error("Exporting the demo answers failed:", error);
  process.exitCode = 1;
});
