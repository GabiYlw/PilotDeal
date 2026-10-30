import type { OpenDealStage } from "../modules/deals/deals.schemas.js";
import type { InteractionType } from "../modules/interactions/interactions.schemas.js";

export interface ScoredDeal {
  id: string;
  title: string;
  value: number;
  stage: OpenDealStage;
  /** YYYY-MM-DD, same as Deal. */
  expectedCloseDate: string | null;
  createdAt: Date;
}

export interface RecentInteraction {
  type: InteractionType;
  notes: string;
  occurredAt: Date;
}

export interface DealContext {
  deal: ScoredDeal;
  companyName: string;
  /** Total interactions of the deal; can be greater than recentInteractions.length. */
  interactionCount: number;
  /** At most 5, newest first. */
  recentInteractions: RecentInteraction[];
}

export type RuleFactorName = "daysSinceContact" | "closeDate" | "closeDatePassed" | "stage" | "value";

export const AI_ADJUSTMENT_FACTOR_NAME = "AI adjustment from interaction notes";

export type PriorityFactorName = RuleFactorName | typeof AI_ADJUSTMENT_FACTOR_NAME;

// Factor produced by RuleBasedScorer; its exhaustive switch only needs the rule names.
export interface RuleFactor {
  name: RuleFactorName;
  points: number;
}

export interface PriorityFactor {
  name: PriorityFactorName;
  points: number;
}

export type ScoredBy = "rules" | "llm";

export interface PriorityResult {
  score: number;
  reason: string;
  nextAction: string;
  factors: PriorityFactor[];
  scoredBy: ScoredBy;
}

// Strategy interface. score() is async because LlmScorer calls the network.
export interface PriorityScorer {
  score(context: DealContext): Promise<PriorityResult>;
}
