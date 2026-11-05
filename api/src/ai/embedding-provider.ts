// Must match the vector(384) column of Interaction.embedding.
export const EMBEDDING_DIMENSIONS = 384;

// Strategy interface: callers depend on this, so another provider can be added later
// by changing only container.ts.
export interface EmbeddingProvider {
  /** Length of every vector returned by embed(). */
  readonly dimensions: number;
  /** One vector per input text, in input order. An empty input resolves to []. */
  embed(texts: string[]): Promise<number[][]>;
}

// A plain Error on purpose: it is handled where embeddings are used and never reaches HTTP directly.
export class EmbeddingOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingOutputError";
  }
}

// Every caller goes through embedTexts/embedText, so a misbehaving provider can never
// produce a malformed vector that reaches the database.
export async function embedTexts(
  provider: EmbeddingProvider,
  texts: string[],
): Promise<number[][]> {
  const vectors = await provider.embed(texts);
  if (vectors.length !== texts.length) {
    throw new EmbeddingOutputError(
      `Expected ${texts.length} embeddings but the provider returned ${vectors.length}`,
    );
  }
  for (const vector of vectors) {
    if (vector.length !== provider.dimensions) {
      throw new EmbeddingOutputError(
        `Expected embeddings of length ${provider.dimensions} but got ${vector.length}`,
      );
    }
    if (!vector.every(Number.isFinite)) {
      throw new EmbeddingOutputError("Embedding contains a non-finite value");
    }
  }
  return vectors;
}

export async function embedText(provider: EmbeddingProvider, text: string): Promise<number[]> {
  const [vector] = await embedTexts(provider, [text]);
  if (!vector) {
    throw new EmbeddingOutputError("The provider returned no embedding");
  }
  return vector;
}
