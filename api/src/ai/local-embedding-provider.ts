import {
  EMBEDDING_DIMENSIONS,
  EmbeddingOutputError,
  type EmbeddingProvider,
} from "./embedding-provider.js";

export const LOCAL_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

// Narrow views of the transformers.js types, so this class and its tests do not depend on the library.
export interface EmbeddingTensor {
  data: Float32Array;
  dims: number[];
}
export interface FeatureExtractionOptions {
  pooling: "mean";
  normalize: true;
}
export type FeatureExtractor = (
  texts: string[],
  options: FeatureExtractionOptions,
) => Promise<EmbeddingTensor>;
export type FeatureExtractorLoader = (model: string) => Promise<FeatureExtractor>;

export class LocalEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = EMBEDDING_DIMENSIONS;
  private extractorPromise: Promise<FeatureExtractor> | null = null;

  // No I/O here: the model is only loaded on the first embed() call.
  constructor(
    private readonly loadExtractor: FeatureExtractorLoader,
    private readonly model: string,
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }
    const extractor = await this.getExtractor();
    const tensor = await extractor(texts, { pooling: "mean", normalize: true });
    return toVectors(tensor, texts.length, this.dimensions);
  }

  // The promise is cached, not the resolved value, so concurrent first calls share one load.
  // A failed load clears the cache so the next call retries without a server restart.
  private getExtractor(): Promise<FeatureExtractor> {
    this.extractorPromise ??= this.loadExtractor(this.model).catch((error: unknown) => {
      this.extractorPromise = null;
      throw error;
    });
    return this.extractorPromise;
  }
}

function toVectors(tensor: EmbeddingTensor, count: number, dimensions: number): number[][] {
  const [rows, columns] = tensor.dims;
  if (
    tensor.dims.length !== 2 ||
    rows !== count ||
    columns !== dimensions ||
    tensor.data.length !== count * dimensions
  ) {
    throw new EmbeddingOutputError(
      `Unexpected embedding tensor shape [${tensor.dims.join(", ")}] for ${count} text(s)`,
    );
  }
  return Array.from({ length: count }, (_, index) =>
    Array.from(tensor.data.subarray(index * dimensions, (index + 1) * dimensions)),
  );
}
