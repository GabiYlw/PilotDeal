import { describe, expect, it, vi } from "vitest";
import type { Config } from "../../src/config/env.js";
import { NoAnswerGenerator } from "../../src/ai/answer-generator.js";
import { LlmAnswerGenerator } from "../../src/ai/llm-answer-generator.js";
import { AnthropicLlmClient } from "../../src/ai/llm-client.js";
import {
  createAnswerGenerator,
  createLlmClient,
  createPriorityScorers,
} from "../../src/container.js";
import { LlmScorer } from "../../src/scoring/llm-scorer.js";
import { RuleBasedScorer } from "../../src/scoring/rule-based-scorer.js";

const clock = { now: () => new Date("2026-03-15T12:00:00.000Z") };
const logger = { warn: vi.fn() };

function config(anthropicApiKey: string | undefined): Config {
  return {
    databaseUrl: "postgresql://x:y@localhost:5432/db",
    databaseUrlTest: undefined,
    port: 3001,
    anthropicApiKey,
    anthropicModel: "claude-haiku-5-5",
  };
}

describe("createPriorityScorers", () => {
  it("uses the same rule-based scorer for both without an API key", () => {
    const { listScorer, actionScorer } = createPriorityScorers(
      createLlmClient(config(undefined)),
      clock,
      logger,
    );

    expect(listScorer).toBeInstanceOf(RuleBasedScorer);
    expect(actionScorer).toBeInstanceOf(RuleBasedScorer);
    expect(actionScorer).toBe(listScorer);
  });

  it("uses the LLM scorer for next actions and rules for the list with an API key", () => {
    const { listScorer, actionScorer } = createPriorityScorers(
      createLlmClient(config("test-key")),
      clock,
      logger,
    );

    expect(actionScorer).toBeInstanceOf(LlmScorer);
    expect(listScorer).toBeInstanceOf(RuleBasedScorer);
    expect(listScorer).not.toBeInstanceOf(LlmScorer);
  });
});

describe("createLlmClient", () => {
  it("returns an Anthropic client with an API key", () => {
    expect(createLlmClient(config("test-key"))).toBeInstanceOf(AnthropicLlmClient);
  });

  it("returns undefined without an API key", () => {
    expect(createLlmClient(config(undefined))).toBeUndefined();
  });
});

describe("createAnswerGenerator", () => {
  it("uses the LLM generator when an LLM client exists", () => {
    const generator = createAnswerGenerator(createLlmClient(config("test-key")), clock, logger);

    expect(generator).toBeInstanceOf(LlmAnswerGenerator);
  });

  it("uses the no-answer generator without an LLM client", () => {
    const generator = createAnswerGenerator(createLlmClient(config(undefined)), clock, logger);

    expect(generator).toBeInstanceOf(NoAnswerGenerator);
  });
});
