import type { EmbeddingSettings } from "../config/env.js";
import { EmbeddingOutputError } from "./embedding-provider.js";
import type { FeatureExtractor } from "./local-embedding-provider.js";

// The only file that references @huggingface/transformers. The import is dynamic, so importing
// the container (server, tests, scripts) never loads onnxruntime, and nothing is downloaded
// until the first real embed() call.
export async function loadTransformersExtractor(
  model: string,
  settings: EmbeddingSettings,
): Promise<FeatureExtractor> {
  const { env, pipeline } = await import("@huggingface/transformers");
  // transformers.js keeps these settings on a module-level object, so set them before loading.
  if (settings.cacheDir) {
    env.cacheDir = settings.cacheDir;
  }
  // Offline: use only the cached model and fail instead of downloading it.
  env.allowRemoteModels = !settings.offline;
  const extractor = await pipeline("feature-extraction", model, { dtype: "fp32" });
  return async (texts, options) => {
    const output = await extractor(texts, options);
    return { data: toFloat32(output.data), dims: [...output.dims] };
  };
}

function toFloat32(data: unknown): Float32Array {
  if (data instanceof Float32Array) {
    return data;
  }
  throw new EmbeddingOutputError("The embedding model did not return float32 data");
}
