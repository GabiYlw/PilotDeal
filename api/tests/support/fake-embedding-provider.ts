import { EMBEDDING_DIMENSIONS, type EmbeddingProvider } from "../../src/ai/embedding-provider.js";

export const FAKE_EMBEDDING_VOCABULARY = [
  "price",
  "budget",
  "timeline",
  "delay",
  "contract",
  "competitor",
] as const;

// Texts without any vocabulary word share this dimension, so a vector is never all zeros.
export const FAKE_OTHER_DIMENSION = FAKE_EMBEDDING_VOCABULARY.length;

// Deterministic keyword vector: term counts over a small vocabulary, L2-normalized.
// Exact token match only ("pricing" does not match "price").
export function fakeEmbedding(text: string): number[] {
  const tokens = text.toLowerCase().match(/[a-z]+/g) ?? [];
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  let matched = false;
  for (const token of tokens) {
    const index = FAKE_EMBEDDING_VOCABULARY.findIndex((word) => word === token);
    if (index >= 0) {
      vector[index] = (vector[index] ?? 0) + 1;
      matched = true;
    }
  }
  if (!matched) {
    vector[FAKE_OTHER_DIMENSION] = 1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  return vector.map((value) => value / norm);
}

export class FakeEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = EMBEDDING_DIMENSIONS;
  readonly calls: string[][] = [];
  private failure: Error | null = null;

  failWith(error: Error = new Error("Fake embedding failure")): void {
    this.failure = error;
  }

  reset(): void {
    this.calls.length = 0;
    this.failure = null;
  }

  embed(texts: string[]): Promise<number[][]> {
    this.calls.push([...texts]);
    if (this.failure) {
      return Promise.reject(this.failure);
    }
    return Promise.resolve(texts.map(fakeEmbedding));
  }
}
