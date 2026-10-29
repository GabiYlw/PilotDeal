import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmbeddingOutputError } from "../../src/ai/embedding-provider.js";

const mocks = vi.hoisted(() => ({ pipeline: vi.fn(), extractor: vi.fn() }));

vi.mock("@huggingface/transformers", () => ({ pipeline: mocks.pipeline }));

const { loadTransformersExtractor } = await import("../../src/ai/transformers-extractor.js");

beforeEach(() => {
  mocks.pipeline.mockReset();
  mocks.extractor.mockReset();
  mocks.pipeline.mockResolvedValue(mocks.extractor);
});

describe("loadTransformersExtractor", () => {
  it("creates a feature-extraction pipeline with fp32 once and forwards texts and options", async () => {
    const data = new Float32Array([1, 2, 3, 4]);
    mocks.extractor.mockResolvedValue({ data, dims: [2, 2] });

    const extract = await loadTransformersExtractor("some/model");
    const result = await extract(["a", "b"], { pooling: "mean", normalize: true });

    expect(mocks.pipeline).toHaveBeenCalledTimes(1);
    expect(mocks.pipeline).toHaveBeenCalledWith("feature-extraction", "some/model", {
      dtype: "fp32",
    });
    expect(mocks.extractor).toHaveBeenCalledWith(["a", "b"], { pooling: "mean", normalize: true });
    expect(result).toEqual({ data, dims: [2, 2] });
  });

  it("rejects with EmbeddingOutputError when the model does not return float32 data", async () => {
    mocks.extractor.mockResolvedValue({ data: new Float64Array(2), dims: [1, 2] });

    const extract = await loadTransformersExtractor("some/model");

    await expect(extract(["a"], { pooling: "mean", normalize: true })).rejects.toBeInstanceOf(
      EmbeddingOutputError,
    );
  });
});
