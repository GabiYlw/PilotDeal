import { type EmbeddingProvider, embedText, embedTexts } from "../../ai/embedding-provider.js";
import { describeError } from "../../shared/describe-error.js";
import type { Logger } from "../../shared/logger.js";
import type { InteractionRepository } from "./interactions.repository.js";
import type { EmbeddableInteraction } from "./interactions.schemas.js";

export const EMBEDDING_BACKFILL_BATCH_SIZE = 32;

export interface EmbeddingBackfillResult {
  updated: number;
  failed: number;
}

export class InteractionEmbeddingService {
  constructor(
    private readonly interactionRepository: InteractionRepository,
    private readonly embeddingProvider: EmbeddingProvider,
    private readonly logger: Logger,
  ) {}

  // Never rejects: an embedding problem must not fail the request that saved the interaction.
  // Logs contain ids and error text only, never the notes or the vector.
  async refreshEmbedding(interaction: EmbeddableInteraction): Promise<void> {
    try {
      const vector = await embedText(this.embeddingProvider, interaction.notes);
      await this.interactionRepository.saveEmbedding(interaction.id, interaction.notes, vector);
    } catch (error) {
      this.logger.warn("Could not embed interaction notes; the embedding is left empty", {
        interactionId: interaction.id,
        error: describeError(error),
      });
      // A vector of the old notes would be misleading, so it is cleared. The backfill restores it.
      await this.clearQuietly(interaction);
    }
  }

  async backfillMissing(
    batchSize: number = EMBEDDING_BACKFILL_BATCH_SIZE,
  ): Promise<EmbeddingBackfillResult> {
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new RangeError("batchSize must be a positive integer");
    }
    const total: EmbeddingBackfillResult = { updated: 0, failed: 0 };
    let afterId: string | null = null;
    for (;;) {
      const batch = await this.interactionRepository.listMissingEmbeddings(afterId, batchSize);
      const last = batch.at(-1);
      if (!last) {
        return total;
      }
      const result = await this.embedBatch(batch);
      total.updated += result.updated;
      total.failed += result.failed;
      if (batch.length < batchSize) {
        return total;
      }
      afterId = last.id;
    }
  }

  // Embedding errors are counted as failed. Repository (database) errors propagate on purpose.
  private async embedBatch(batch: EmbeddableInteraction[]): Promise<EmbeddingBackfillResult> {
    let vectors: number[][];
    try {
      vectors = await embedTexts(
        this.embeddingProvider,
        batch.map((row) => row.notes),
      );
    } catch (error) {
      this.logger.warn("Could not embed a batch of interactions", {
        interactionIds: batch.map((row) => row.id),
        error: describeError(error),
      });
      return { updated: 0, failed: batch.length };
    }
    let updated = 0;
    for (const [index, row] of batch.entries()) {
      const vector = vectors[index];
      // A false result means the notes changed meanwhile: neither updated nor failed.
      if (vector && (await this.interactionRepository.saveEmbedding(row.id, row.notes, vector))) {
        updated += 1;
      }
    }
    return { updated, failed: 0 };
  }

  private async clearQuietly(interaction: EmbeddableInteraction): Promise<void> {
    try {
      await this.interactionRepository.clearEmbedding(interaction.id, interaction.notes);
    } catch (error) {
      this.logger.warn("Could not clear a stale interaction embedding", {
        interactionId: interaction.id,
        error: describeError(error),
      });
    }
  }
}
