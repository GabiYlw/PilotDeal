import type { OpenDealStage } from "../modules/deals/deals.schemas.js";
import type { Clock } from "../shared/clock.js";
import type {
  DealContext,
  PriorityResult,
  PriorityScorer,
  RuleFactor,
  RuleFactorName,
} from "./priority-scorer.js";

const DAY_MS = 86_400_000;
const CONTACT_FOLLOW_UP_DAYS = 15;

const STAGE_POINTS: Record<OpenDealStage, number> = {
  LEAD: 5,
  QUALIFIED: 10,
  PROPOSAL: 20,
  NEGOTIATION: 25,
};

const STAGE_ACTIONS: Record<OpenDealStage, string> = {
  LEAD: "Schedule a discovery call to qualify the lead.",
  QUALIFIED: "Prepare and send a proposal.",
  PROPOSAL: "Follow up on the proposal and address open questions.",
  NEGOTIATION: "Agree on final terms and close the deal.",
};

interface Metrics {
  daysSinceContact: number;
  daysUntilClose: number | null;
  stage: OpenDealStage;
  value: number;
}

// UTC calendar-day index: only getTime() arithmetic, so the machine timezone is irrelevant.
function utcDay(date: Date): number {
  return Math.floor(date.getTime() / DAY_MS);
}

function isoDateToUtcDay(isoDate: string): number {
  return utcDay(new Date(`${isoDate}T00:00:00.000Z`));
}

// Computed as a max, not read from array position, so the order of the input does not matter.
function latestContact(context: DealContext): Date {
  return context.recentInteractions.reduce(
    (latest, interaction) => (interaction.occurredAt > latest ? interaction.occurredAt : latest),
    context.recentInteractions[0]?.occurredAt ?? context.deal.createdAt,
  );
}

function daysSinceContactPoints(days: number): number {
  if (days >= 22) return 30;
  if (days >= 15) return 25;
  if (days >= 8) return 20;
  if (days >= 4) return 10;
  return 0;
}

function closeDatePoints(daysUntilClose: number | null): number {
  if (daysUntilClose === null || daysUntilClose >= 31) return 0;
  if (daysUntilClose < 0) return 25;
  if (daysUntilClose <= 7) return 20;
  return 10;
}

function valuePoints(value: number): number {
  if (value >= 50_000) return 20;
  if (value >= 20_000) return 15;
  if (value >= 5_000) return 10;
  return 5;
}

function formatValue(value: number): string {
  const decimals = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function computeMetrics(context: DealContext, today: number): Metrics {
  const { deal } = context;
  return {
    daysSinceContact: Math.max(0, today - utcDay(latestContact(context))),
    daysUntilClose: deal.expectedCloseDate ? isoDateToUtcDay(deal.expectedCloseDate) - today : null,
    stage: deal.stage,
    value: deal.value,
  };
}

function buildFactors(metrics: Metrics): RuleFactor[] {
  const all: RuleFactor[] = [
    { name: "daysSinceContact", points: daysSinceContactPoints(metrics.daysSinceContact) },
    { name: "closeDate", points: closeDatePoints(metrics.daysUntilClose) },
    { name: "stage", points: STAGE_POINTS[metrics.stage] },
    { name: "value", points: valuePoints(metrics.value) },
  ];
  return all.filter((factor) => factor.points > 0);
}

// The closeDate factor only exists when there is a date; null cannot reach this point.
function closeDatePhrase(daysUntilClose: number): string {
  if (daysUntilClose < 0) {
    return `the expected close date passed ${-daysUntilClose} days ago`;
  }
  return `the expected close date is in ${daysUntilClose} days`;
}

function factorPhrase(name: RuleFactorName, metrics: Metrics): string {
  switch (name) {
    case "daysSinceContact":
      return `no contact for ${metrics.daysSinceContact} days`;
    case "closeDate":
      return closeDatePhrase(metrics.daysUntilClose ?? 0);
    case "stage":
      return `the deal is in the ${metrics.stage.toLowerCase()} stage`;
    case "value":
      return `the deal is worth ${formatValue(metrics.value)}`;
  }
}

// Factors are already in tie-break order and Array.sort is stable, so equal points keep that order.
function buildReason(factors: RuleFactor[], metrics: Metrics): string {
  const sentence = [...factors]
    .sort((a, b) => b.points - a.points)
    .slice(0, 2)
    .map((factor) => factorPhrase(factor.name, metrics))
    .join(" and ");
  return `${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}.`;
}

function buildNextAction(metrics: Metrics, companyName: string): string {
  if (metrics.daysUntilClose !== null && metrics.daysUntilClose < 0) {
    return `Confirm a new close date or push for a decision with ${companyName}.`;
  }
  if (metrics.daysSinceContact >= CONTACT_FOLLOW_UP_DAYS) {
    return `Follow up with ${companyName}: no contact for ${metrics.daysSinceContact} days.`;
  }
  return STAGE_ACTIONS[metrics.stage];
}

export class RuleBasedScorer implements PriorityScorer {
  constructor(private readonly clock: Clock) {}

  // Not async on purpose: nothing is awaited (lint rule require-await).
  score(context: DealContext): Promise<PriorityResult> {
    const metrics = computeMetrics(context, utcDay(this.clock.now()));
    const factors = buildFactors(metrics);
    return Promise.resolve({
      score: factors.reduce((sum, factor) => sum + factor.points, 0),
      reason: buildReason(factors, metrics),
      nextAction: buildNextAction(metrics, context.companyName),
      factors,
      scoredBy: "rules",
    });
  }
}
