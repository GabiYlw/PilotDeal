import "dotenv/config";
import { loadEmbeddingSettings } from "../config/env.js";
import { createEmbeddingProvider } from "../container.js";

// Downloads the embedding model into EMBEDDING_CACHE_DIR (or the default cache) and embeds one
// text to prove it works. The Docker build runs this so containers never download at runtime.
async function downloadEmbeddingModel(): Promise<void> {
  const settings = { ...loadEmbeddingSettings(), offline: false };
  const provider = createEmbeddingProvider(settings);
  const [vector] = await provider.embed(["warm-up"]);
  console.log(
    `Embedding model ready (${vector?.length ?? 0} dimensions) in ${settings.cacheDir ?? "the default cache"}`,
  );
}

downloadEmbeddingModel().catch((error: unknown) => {
  console.error("Embedding model download failed:", error);
  process.exitCode = 1;
});
