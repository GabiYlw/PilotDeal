// Deal stages as plain constants and types, with no zod: the rule-based scorer imports them, and
// the static demo (web/src/demo) runs that scorer in the browser. deals.schemas.ts builds its zod
// schema from these and re-exports them.
export const DEAL_STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];

export const OPEN_DEAL_STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] as const;
export type OpenDealStage = (typeof OPEN_DEAL_STAGES)[number];

export function isOpenStage(stage: DealStage): stage is OpenDealStage {
  return (OPEN_DEAL_STAGES as readonly DealStage[]).includes(stage);
}
