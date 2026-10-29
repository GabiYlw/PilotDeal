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

export type PriorityFactorName = "daysSinceContact" | "closeDate" | "stage" | "value";

export interface PriorityFactor {
  name: PriorityFactorName;
  points: number;
}

export interface PriorityResult {
  score: number;
  reason: string;
  nextAction: string;
  factors: PriorityFactor[];
  scoredBy: "rules";
}

// Strategy interface. score() is async because the planned LlmScorer will call the network.
export interface PriorityScorer {
  score(context: DealContext): Promise<PriorityResult>;
}
