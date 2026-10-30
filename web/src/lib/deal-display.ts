import type { BadgeVariant } from "@/components/ui/badge";
import type {
  DealStage,
  InteractionType,
  PriorityFactor,
  PriorityFactorName,
  ScoredBy,
} from "./types";

export const STAGE_LABELS: Record<DealStage, string> = {
  LEAD: "Lead",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

// State colors are reserved for the two closed outcomes.
export function stageBadgeVariant(stage: DealStage): BadgeVariant {
  if (stage === "WON") return "success";
  if (stage === "LOST") return "danger";
  return "neutral";
}

export const INTERACTION_TYPE_LABELS: Record<InteractionType, string> = {
  EMAIL: "Email",
  CALL: "Call",
  MEETING: "Meeting",
  NOTE: "Note",
};

const FACTOR_LABELS: Record<PriorityFactorName, string> = {
  daysSinceContact: "Days since last contact",
  closeDate: "Close date approaching",
  closeDatePassed: "Close date passed",
  stage: "Stage",
  value: "Deal value",
  "AI adjustment from interaction notes": "AI adjustment from interaction notes",
};

function isFactorName(name: string): name is PriorityFactorName {
  return Object.hasOwn(FACTOR_LABELS, name);
}

// Unknown names (a newer API) fall back to the raw name.
export function factorLabel(name: string): string {
  return isFactorName(name) ? FACTOR_LABELS[name] : name;
}

export function formatPoints(points: number): string {
  if (points > 0) return `+${points}`;
  return String(points);
}

export const OVERDUE_FACTOR_NAME = "closeDatePassed";

// The API decides what overdue means; this only reads its factor.
export function isOverdue(factors: PriorityFactor[]): boolean {
  return factors.some((factor) => factor.name === OVERDUE_FACTOR_NAME);
}

export function scoredByLook(scoredBy: ScoredBy): { variant: BadgeVariant; text: string } {
  if (scoredBy === "llm") return { variant: "accent", text: "Scored by AI" };
  return { variant: "neutral", text: "Scored by rules" };
}
