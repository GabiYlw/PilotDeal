import { afterEach, describe, expect, it, vi } from "vitest";
import { loadTestConfig } from "./test-env.js";

describe("loadTestConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("drops the Anthropic API key even when ANTHROPIC_API_KEY is set", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-should-not-be-used");

    expect(loadTestConfig().anthropicApiKey).toBeUndefined();
  });
});
