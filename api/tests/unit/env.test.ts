import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/config/env.js";

const validEnv = { DATABASE_URL: "postgresql://user:pass@localhost:5432/pilotdeal" };

describe("loadConfig", () => {
  it("applies defaults for optional variables", () => {
    expect(loadConfig(validEnv)).toEqual({
      databaseUrl: validEnv.DATABASE_URL,
      databaseUrlTest: undefined,
      port: 3001,
      anthropicApiKey: undefined,
      anthropicModel: "claude-haiku-5-5",
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
});
