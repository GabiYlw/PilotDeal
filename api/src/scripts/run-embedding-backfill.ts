import type { Config } from "../config/env.js";
import { type ContainerOverrides, createContainer } from "../container.js";
import type { EmbeddingBackfillResult } from "../modules/interactions/interaction-embeddings.service.js";

export function formatBackfillResult(result: EmbeddingBackfillResult): string {
  return `Embedding backfill: ${result.updated} updated, ${result.failed} failed.`;
}

// Wires the container, runs the backfill, prints one line and always closes the database.
// Shared by the embed:backfill script and the seed.
export async function runEmbeddingBackfill(
  config: Config,
  overrides: ContainerOverrides = {},
): Promise<EmbeddingBackfillResult> {
  const container = createContainer(config, overrides);
  try {
    const result = await container.interactionEmbeddings.backfillMissing();
    console.log(formatBackfillResult(result));
    return result;
  } finally {
    await container.disconnect();
  }
}
