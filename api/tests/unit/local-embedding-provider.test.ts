import { describe, expect, it, vi } from "vitest";
import { EmbeddingOutputError } from "../../src/ai/embedding-provider.js";
import {
  type EmbeddingTensor,
  type FeatureExtractor,
  LOCAL_EMBEDDING_MODEL,
  LocalEmbeddingProvider,
} from "../../src/ai/local-embedding-provider.js";

const DIMS = 384;

// Row i has the value (i + 1) * 1000 + column, so every row and column is distinct.
function tensorFor(count: number): EmbeddingTensor {
  const data = new Float32Array(count * DIMS);
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < DIMS; column += 1) {
      data[row * DIMS + column] = (row + 1) * 1000 + column;
    }
  }
  return { data, dims: [count, DIMS] };
}

function createExtractor() {
  return vi.fn<FeatureExtractor>((texts) => Promise.resolve(tensorFor(texts.length)));
}

function setup() {
  const extractor = createExtractor();
  const loader = vi.fn((_model: string) => Promise.resolve<FeatureExtractor>(extractor));
  const provider = new LocalEmbeddingProvider(loader, LOCAL_EMBEDDING_MODEL);
  return { extractor, loader, provider };
}

describe("LocalEmbeddingProvider", () => {
  it("reports 384 dimensions", () => {
    expect(setup().provider.dimensions).toBe(384);
  });

  it("calls the extractor once with mean pooling and normalization and returns one 384-length vector per text", async () => {
    const { extractor, provider } = setup();
    const expected = tensorFor(2);

    const vectors = await provider.embed(["a", "b"]);

    expect(extractor).toHaveBeenCalledTimes(1);
    expect(extractor).toHaveBeenCalledWith(["a", "b"], { pooling: "mean", normalize: true });
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toHaveLength(384);
    expect(vectors[1]).toHaveLength(384);
    expect(vectors[0]).toEqual(Array.from(expected.data.subarray(0, DIMS)));
    expect(vectors[1]).toEqual(Array.from(expected.data.subarray(DIMS, 2 * DIMS)));
  });

  it("loads the configured model name", async () => {
    const { loader, provider } = setup();

    await provider.embed(["a"]);

    expect(loader).toHaveBeenCalledWith("Xenova/all-MiniLM-L6-v2");
  });

  it("does not load the model when constructed", () => {
    expect(setup().loader).not.toHaveBeenCalled();
  });

  it("resolves an empty input to [] without loading the model", async () => {
    const { loader, extractor, provider } = setup();

    await expect(provider.embed([])).resolves.toEqual([]);
    expect(loader).not.toHaveBeenCalled();
    expect(extractor).not.toHaveBeenCalled();
  });

  it("loads the model once for concurrent first calls and for later calls", async () => {
    const extractor = createExtractor();
    let resolveLoad: (value: FeatureExtractor) => void = () => undefined;
    const loader = vi.fn(
      (_model: string) =>
        new Promise<FeatureExtractor>((resolve) => {
          resolveLoad = resolve;
        }),
    );
    const provider = new LocalEmbeddingProvider(loader, LOCAL_EMBEDDING_MODEL);

    const pending = Promise.all([
      provider.embed(["a"]),
      provider.embed(["b"]),
      provider.embed(["c"]),
    ]);
    resolveLoad(extractor);
    const results = await pending;
    await provider.embed(["d"]);

    expect(results).toHaveLength(3);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(extractor).toHaveBeenCalledTimes(4);
  });

  it("rejects every concurrent caller when the load fails, then retries the load on the next call", async () => {
    const extractor = createExtractor();
    const loader = vi
      .fn<(model: string) => Promise<FeatureExtractor>>()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValue(extractor);
    const provider = new LocalEmbeddingProvider(loader, LOCAL_EMBEDDING_MODEL);

    const results = await Promise.allSettled([provider.embed(["a"]), provider.embed(["b"])]);

    expect(results.map((result) => result.status)).toEqual(["rejected", "rejected"]);
    expect(loader).toHaveBeenCalledTimes(1);
    await expect(provider.embed(["c"])).resolves.toHaveLength(1);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["wrong column count", { data: new Float32Array(2 * 383), dims: [2, 383] }],
    ["wrong row count", { data: new Float32Array(1 * DIMS), dims: [1, DIMS] }],
    ["data too short for the dims", { data: new Float32Array(DIMS), dims: [2, DIMS] }],
    ["data too long for the dims", { data: new Float32Array(3 * DIMS), dims: [2, DIMS] }],
    ["three dimensions", { data: new Float32Array(2 * DIMS), dims: [2, DIMS, 1] }],
    ["one dimension", { data: new Float32Array(2 * DIMS), dims: [2 * DIMS] }],
  ] satisfies [string, EmbeddingTensor][])(
    "rejects with EmbeddingOutputError for a tensor with %s",
    async (_name, tensor) => {
      const loader = vi.fn((_model: string) =>
        Promise.resolve<FeatureExtractor>(() => Promise.resolve(tensor)),
      );
      const provider = new LocalEmbeddingProvider(loader, LOCAL_EMBEDDING_MODEL);

      await expect(provider.embed(["a", "b"])).rejects.toBeInstanceOf(EmbeddingOutputError);
    },
  );
});
