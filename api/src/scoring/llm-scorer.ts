import { z } from "zod";
import type { LlmClient } from "../ai/llm-client.js";
import {
  buildPriorityPrompt,
  PRIORITY_MAX_TOKENS,
  PRIORITY_SYSTEM_PROMPT,
  PRIORITY_TOOL,
} from "../ai/prompts.js";
import type { Clock } from "../shared/clock.js";
import { describeError } from "../shared/describe-error.js";
import type { Logger } from "../shared/logger.js";
import {
  AI_ADJUSTMENT_FACTOR_NAME,
  type DealContext,
  type PriorityResult,
  type PriorityScorer,
} from "./priority-scorer.js";

export const MAX_LLM_ADJUSTMENT = 20;

// Non-strict on purpose: extra keys from the model are stripped, not an error.
export const llmPriorityOutputSchema = z.object({
  score: z.number().int().min(0).max(100),
  reason: z.string().trim().min(1).max(1000),
  nextAction: z.string().trim().min(1).max(1000),
});

export type LlmPriorityOutput = z.infer<typeof llmPriorityOutputSchema>;

export class LlmScorer implements PriorityScorer {
  constructor(
    private readonly llmClient: LlmClient,
    private readonly fallback: PriorityScorer,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  async score(context: DealContext): Promise<PriorityResult> {
    // Outside the try: a failing fallback is not an LLM failure.
    const baseline = await this.fallback.score(context);
    // Without notes there is nothing for the model to read, so the baseline is the answer.
    if (context.interactionCount === 0) {
      return baseline;
    }
    try {
      const rawInput = await this.llmClient.callTool({
        system: PRIORITY_SYSTEM_PROMPT,
        prompt: buildPriorityPrompt(context, baseline, this.clock.now()),
        tool: PRIORITY_TOOL,
        maxTokens: PRIORITY_MAX_TOKENS,
      });
      return combine(baseline, llmPriorityOutputSchema.parse(rawInput));
    } catch (error: unknown) {
      // Only the deal id and the error text are logged, never notes, prompt or key.
      this.logger.warn("LLM scoring failed, falling back to the rule-based score", {
        dealId: context.deal.id,
        error: describeError(error),
      });
      return baseline;
    }
  }
}

// The +-20 band is the guardrail against a wrong or injected score; 0..100 is applied after it.
function clampScore(llmScore: number, baselineScore: number): number {
  const banded = Math.min(
    baselineScore + MAX_LLM_ADJUSTMENT,
    Math.max(baselineScore - MAX_LLM_ADJUSTMENT, llmScore),
  );
  return Math.min(100, Math.max(0, banded));
}

// The adjustment factor keeps the invariant that factors sum to the score.
function combine(baseline: PriorityResult, output: LlmPriorityOutput): PriorityResult {
  const score = clampScore(output.score, baseline.score);
  const adjustment = score - baseline.score;
  return {
    score,
    reason: output.reason,
    nextAction: output.nextAction,
    factors:
      adjustment === 0
        ? [...baseline.factors]
        : [...baseline.factors, { name: AI_ADJUSTMENT_FACTOR_NAME, points: adjustment }],
    scoredBy: "llm",
  };
}
