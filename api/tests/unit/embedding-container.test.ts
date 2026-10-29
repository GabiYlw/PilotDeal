import { describe, expect, it, vi } from "vitest";
import type { EmbeddingProvider } from "../../src/ai/embedding-provider.js";
import { LocalEmbeddingProvider } from "../../src/ai/local-embedding-provider.js";
import type { Config } from "../../src/config/env.js";

const mocks = vi.hoisted(() => ({ pipeline: vi.fn() }));

vi.mock("@huggingface/transformers", () => ({ pipeline: mocks.pipeline }));

const { createContainer, createEmbeddingProvider } = await import("../../src/container.js");

const config: Config = {
  databaseUrl: "postgresql://x:y@localhost:5432/db",
  databaseUrlTest: undefined,
  port: 3001,
  anthropicApiKey: undefined,
  anthropicModel: "claude-haiku-5-5",
};

describe("createEmbeddingProvider", () => {
  it("returns a local provider with 384 dimensions and loads no model when built", () => {
    const provider = createEmbeddingProvider();

    expect(provider).toBeInstanceOf(LocalEmbeddingProvider);
    expect(provider.dimensions).toBe(384);
    expect(mocks.pipeline).not.toHaveBeenCalled();
  });
});

describe("createContainer", () => {
  it("fails fast when the embedding provider does not have 384 dimensions", () => {
    const provider: EmbeddingProvider = { dimensions: 128, embed: () => Promise.resolve([]) };

    expect(() => createContainer(config, { embeddingProvider: provider })).toThrow(
      "Embedding provider has 128 dimensions, but the database column is vector(384)",
    );
  });
});
