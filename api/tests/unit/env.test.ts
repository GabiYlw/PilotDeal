import { describe, expect, it } from "vitest";
import { loadConfig, loadEmbeddingSettings } from "../../src/config/env.js";

const validEnv = { DATABASE_URL: "postgresql://user:pass@localhost:5432/pilotdeal" };

describe("loadConfig", () => {
  it("applies defaults for optional variables", () => {
    expect(loadConfig(validEnv)).toEqual({
      databaseUrl: validEnv.DATABASE_URL,
      databaseUrlTest: undefined,
      port: 3001,
      anthropicApiKey: undefined,
      anthropicModel: "claude-haiku-5-5",
      embedding: { cacheDir: undefined, offline: false },
    });
  });

  it("treats an empty ANTHROPIC_API_KEY as missing", () => {
    expect(loadConfig({ ...validEnv, ANTHROPIC_API_KEY: "" }).anthropicApiKey).toBeUndefined();
  });

  it("fails with a message naming DATABASE_URL when it is missing", () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("fails when PORT is not a number", () => {
    expect(() => loadConfig({ ...validEnv, PORT: "abc" })).toThrow(/PORT/);
  });

  it.each([
    {
      env: { EMBEDDING_CACHE_DIR: "/models", EMBEDDING_OFFLINE: "true" },
      cacheDir: "/models",
      offline: true,
    },
    {
      env: { EMBEDDING_CACHE_DIR: "", EMBEDDING_OFFLINE: "" },
      cacheDir: undefined,
      offline: false,
    },
    { env: { EMBEDDING_OFFLINE: "false" }, cacheDir: undefined, offline: false },
  ])("reads embedding settings from $env", ({ env, cacheDir, offline }) => {
    expect(loadConfig({ ...validEnv, ...env }).embedding).toEqual({ cacheDir, offline });
  });

  it("fails when EMBEDDING_OFFLINE is not true or false", () => {
    expect(() => loadConfig({ ...validEnv, EMBEDDING_OFFLINE: "yes" })).toThrow(
      /EMBEDDING_OFFLINE/,
    );
  });
});

describe("loadEmbeddingSettings", () => {
  it("reads embedding settings without requiring DATABASE_URL", () => {
    expect(loadEmbeddingSettings({ EMBEDDING_CACHE_DIR: "/models" })).toEqual({
      cacheDir: "/models",
      offline: false,
    });
  });
});
