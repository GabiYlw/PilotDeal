import type { AnswerGenerator, AnswerSource, GeneratedAnswer } from "../../ai/answer-generator.js";
import { type EmbeddingProvider, embedText } from "../../ai/embedding-provider.js";
import { describeError } from "../../shared/describe-error.js";
import { EmbeddingUnavailableError, NotFoundError } from "../../shared/errors.js";
import type { Logger } from "../../shared/logger.js";
import type { DealRepository } from "../deals/deals.repository.js";
import type { AskRepository } from "./ask.repository.js";
import type { AskInput, AskResponse, AskSource, InteractionSearchRow } from "./ask.schemas.js";

export const MIN_SIMILARITY = 0.25;
export const EXCERPT_LENGTH = 300;

interface LabelledRow {
  label: string;
  row: InteractionSearchRow;
}

export class AskService {
  constructor(
    private readonly askRepository: AskRepository,
    private readonly dealRepository: DealRepository,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly answerGenerator: AnswerGenerator,
    private readonly logger: Logger,
  ) {}

  async ask(input: AskInput): Promise<AskResponse> {
    if (input.dealId !== undefined) {
      // Checked before embedding, so a 404 never pays for an embedding.
      await this.ensureDealExists(input.dealId);
    }
    const embedding = await this.embedQuestion(input.question);
    const rows = await this.askRepository.searchInteractions({
      embedding,
      dealId: input.dealId ?? null,
      maxDistance: 1 - MIN_SIMILARITY,
      limit: input.limit,
    });
    // Nothing to answer from, so the generator (and the LLM) is never called.
    if (rows.length === 0) {
      return sourcesOnly([]);
    }
    const labelled = rows.map((row, index) => ({ label: `S${index + 1}`, row }));
    const sources = labelled.map(toSource);
    const draft = await this.generateAnswer(input.question, labelled);
    if (draft === null) {
      return sourcesOnly(sources);
    }
    const citedInteractionIds = mapCitations(draft.citedLabels, labelled);
    // An answer without a single valid citation is not grounded in the sources, so it is dropped.
    if (!draft.insufficientInformation && citedInteractionIds.length === 0) {
      this.logger.warn("LLM answer cited no retrieved source, returning sources only", {
        sourceCount: sources.length,
        citedLabelCount: draft.citedLabels.length,
      });
      return sourcesOnly(sources);
    }
    return {
      answer: draft.answer,
      answeredBy: "llm",
      insufficientInformation: draft.insufficientInformation,
      citedInteractionIds,
      sources,
    };
  }

  // A failed answer must never fail the request: the sources are still useful.
  private async generateAnswer(question: string, labelled: LabelledRow[]): Promise<GeneratedAnswer> {
    try {
      return await this.answerGenerator.generate(question, labelled.map(toAnswerSource));
    } catch (error: unknown) {
      // The question text is never logged.
      this.logger.warn("Answer generation failed, returning sources only", {
        error: describeError(error),
      });
      return null;
    }
  }

  private async embedQuestion(question: string): Promise<number[]> {
    try {
      return await embedText(this.embeddingProvider, question);
    } catch (error) {
      // The question text is never logged.
      this.logger.warn("Could not embed the question", { error: describeError(error) });
      throw new EmbeddingUnavailableError(
        "Semantic search is unavailable: the question could not be embedded",
      );
    }
  }

  private async ensureDealExists(dealId: string): Promise<void> {
    const deal = await this.dealRepository.findById(dealId);
    if (!deal) {
      throw dealNotFound(dealId);
    }
  }
}

function toSource({ label, row: { notes, ...row } }: LabelledRow): AskSource {
  return {
    label,
    ...row,
    // Array.from splits on code points, so a surrogate pair is never cut in half.
    excerpt: Array.from(notes).slice(0, EXCERPT_LENGTH).join(""),
    similarity: roundSimilarity(row.similarity),
  };
}

function toAnswerSource({ label, row }: LabelledRow): AnswerSource {
  const { dealTitle, companyName, type, occurredAt, notes } = row;
  return { label, dealTitle, companyName, type, occurredAt, notes };
}

// Filtering the labelled rows removes duplicates and unknown labels and keeps source order.
function mapCitations(citedLabels: string[], labelled: LabelledRow[]): string[] {
  const cited = new Set(citedLabels.map((label) => label.trim()));
  return labelled.filter(({ label }) => cited.has(label)).map(({ row }) => row.interactionId);
}

function sourcesOnly(sources: AskSource[]): AskResponse {
  return {
    answer: null,
    answeredBy: "none",
    insufficientInformation: false,
    citedInteractionIds: [],
    sources,
  };
}

// The clamp absorbs float noise such as 1.0000001.
function roundSimilarity(similarity: number): number {
  return Math.round(Math.min(1, Math.max(0, similarity)) * 1000) / 1000;
}

function dealNotFound(dealId: string): NotFoundError {
  return new NotFoundError(`Deal ${dealId} not found`);
}
