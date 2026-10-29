import { type EmbeddingProvider, embedText } from "../../ai/embedding-provider.js";
import { describeError } from "../../shared/describe-error.js";
import { EmbeddingUnavailableError, NotFoundError } from "../../shared/errors.js";
import type { Logger } from "../../shared/logger.js";
import type { DealRepository } from "../deals/deals.repository.js";
import type { AskRepository } from "./ask.repository.js";
import type { AskInput, AskResponse, AskSource, InteractionSearchRow } from "./ask.schemas.js";

export const MIN_SIMILARITY = 0.25;
export const EXCERPT_LENGTH = 300;

export class AskService {
  constructor(
    private readonly askRepository: AskRepository,
    private readonly dealRepository: DealRepository,
    private readonly embeddingProvider: EmbeddingProvider,
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
    return { answer: null, answeredBy: "none", sources: rows.map(toSource) };
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

function toSource({ notes, ...row }: InteractionSearchRow): AskSource {
  return {
    ...row,
    // Array.from splits on code points, so a surrogate pair is never cut in half.
    excerpt: Array.from(notes).slice(0, EXCERPT_LENGTH).join(""),
    similarity: roundSimilarity(row.similarity),
  };
}

// The clamp absorbs float noise such as 1.0000001.
function roundSimilarity(similarity: number): number {
  return Math.round(Math.min(1, Math.max(0, similarity)) * 1000) / 1000;
}

function dealNotFound(dealId: string): NotFoundError {
  return new NotFoundError(`Deal ${dealId} not found`);
}
