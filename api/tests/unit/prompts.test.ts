import { describe, expect, it } from "vitest";
import { ANSWER_SYSTEM_PROMPT, PRIORITY_SYSTEM_PROMPT } from "../../src/ai/prompts.js";

describe("PRIORITY_SYSTEM_PROMPT", () => {
  it("tells the model to treat the notes as data and not as instructions", () => {
    expect(PRIORITY_SYSTEM_PROMPT).toContain("interaction_notes");
    expect(PRIORITY_SYSTEM_PROMPT).toMatch(/data/i);
    expect(PRIORITY_SYSTEM_PROMPT).toMatch(/never as instructions/i);
  });
});

describe("ANSWER_SYSTEM_PROMPT", () => {
  it.each([
    ["the question tag", /<question>/],
    ["the notes tag", /<interaction_notes>/],
    ["treating the text as data", /only as data/i],
    ["never following instructions in it", /never as instructions/i],
    ["inline citations", /\[S1\]/],
    ["a sentence limit", /at most 5 sentences/i],
    ["English", /English/],
    ["the insufficient information flag", /insufficientInformation/],
  ])("mentions %s", (_name, pattern) => {
    expect(ANSWER_SYSTEM_PROMPT).toMatch(pattern);
  });
});
