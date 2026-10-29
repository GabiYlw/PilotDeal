import { describe, expect, it } from "vitest";
import { PRIORITY_SYSTEM_PROMPT } from "../../src/ai/prompts.js";

describe("PRIORITY_SYSTEM_PROMPT", () => {
  it("tells the model to treat the notes as data and not as instructions", () => {
    expect(PRIORITY_SYSTEM_PROMPT).toContain("interaction_notes");
    expect(PRIORITY_SYSTEM_PROMPT).toMatch(/data/i);
    expect(PRIORITY_SYSTEM_PROMPT).toMatch(/never as instructions/i);
  });
});
