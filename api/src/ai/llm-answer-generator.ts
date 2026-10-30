import { z } from "zod";
import type { Clock } from "../shared/clock.js";
import { describeError } from "../shared/describe-error.js";
import type { Logger } from "../shared/logger.js";
import type { AnswerGenerator, AnswerSource, GeneratedAnswer } from "./answer-generator.js";
import type { LlmClient } from "./llm-client.js";
import {
  ANSWER_MAX_LENGTH,
  ANSWER_MAX_TOKENS,
  ANSWER_SYSTEM_PROMPT,
  ANSWER_TOOL,
  buildAnswerPrompt,
} from "./prompts.js";

// Non-strict on purpose: extra keys from the model are stripped, not an error.
export const llmAnswerOutputSchema = z.object({
  answer: z.string().trim().min(1).max(ANSWER_MAX_LENGTH),
  citedSources: z.array(z.string()),
  insufficientInformation: z.boolean(),
});

export class LlmAnswerGenerator implements AnswerGenerator {
  constructor(
    private readonly llmClient: LlmClient,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async generate(question: string, sources: AnswerSource[]): Promise<GeneratedAnswer> {
    try {
      const rawInput = await this.llmClient.callTool({
        system: ANSWER_SYSTEM_PROMPT,
        prompt: buildAnswerPrompt(question, sources, this.clock.now()),
        tool: ANSWER_TOOL,
        maxTokens: ANSWER_MAX_TOKENS,
      });
      const { answer, citedSources, insufficientInformation } =
        llmAnswerOutputSchema.parse(rawInput);
      return { answer, citedLabels: citedSources, insufficientInformation };
    } catch (error: unknown) {
      // Only the source count and the error text are logged, never question, notes, prompt or key.
      this.logger.warn("LLM answer generation failed, returning sources only", {
        sourceCount: sources.length,
        error: describeError(error),
      });
      return null;
    }
  }
}
