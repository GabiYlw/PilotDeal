import { beforeEach, describe, expect, it, vi } from "vitest";
import { EmbeddingOutputError } from "../../src/ai/embedding-provider.js";

// Stands in for the library's module-level settings object.
interface TransformersEnv {
  cacheDir?: string;
  allowRemoteModels?: boolean;
}

const mocks = vi.hoisted(() => {
  const env: TransformersEnv = {};
  return { pipeline: vi.fn(), extractor: vi.fn(), env };
});

vi.mock("@huggingface/transformers", () => ({ pipeline: mocks.pipeline, env: mocks.env }));

const onlineDefaults = { cacheDir: undefined, offline: false };

const { loadTransformersExtractor } = await import("../../src/ai/transformers-extractor.js");

beforeEach(() => {
  mocks.pipeline.mockReset();
  mocks.extractor.mockReset();
  mocks.pipeline.mockResolvedValue(mocks.extractor);
  mocks.env.cacheDir = "/library/default";
  mocks.env.allowRemoteModels = true;
});

describe("loadTransformersExtractor", () => {
  it.each([
    {
      settings: onlineDefaults,
      expected: { cacheDir: "/library/default", allowRemoteModels: true },
    },
    {
      settings: { cacheDir: "/models", offline: true },
      expected: { cacheDir: "/models", allowRemoteModels: false },
    },
  ])(
    "applies cache dir and offline mode $settings before loading",
    async ({ settings, expected }) => {
      let envAtLoad: unknown;
      mocks.pipeline.mockImplementation(() => {
        envAtLoad = { ...mocks.env };
        return Promise.resolve(mocks.extractor);
      });

      await loadTransformersExtractor("some/model", settings);

      expect(envAtLoad).toEqual(expected);
    },
  );

  it("creates a feature-extraction pipeline with fp32 once and forwards texts and options", async () => {
    const data = new Float32Array([1, 2, 3, 4]);
    mocks.extractor.mockResolvedValue({ data, dims: [2, 2] });

    const extract = await loadTransformersExtractor("some/model", onlineDefaults);
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

    const extract = await loadTransformersExtractor("some/model", onlineDefaults);

    await expect(extract(["a"], { pooling: "mean", normalize: true })).rejects.toBeInstanceOf(
      EmbeddingOutputError,
    );
  });
});
