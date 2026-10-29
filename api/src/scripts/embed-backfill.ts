import "dotenv/config";
import { loadConfig } from "../config/env.js";
import { runEmbeddingBackfill } from "./run-embedding-backfill.js";

runEmbeddingBackfill(loadConfig())
  .then((result) => {
    if (result.failed > 0) {
      process.exitCode = 1;
    }
  })
  .catch((error: unknown) => {
    console.error("Embedding backfill failed:", error);
    process.exitCode = 1;
  });
