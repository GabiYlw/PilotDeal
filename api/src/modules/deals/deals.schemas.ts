import { z } from "zod";
import type { PriorityResult } from "../../scoring/priority-scorer.js";
import { paginationQuerySchema } from "../../shared/pagination.js";
import { requiredText, strictBody } from "../../shared/validation.js";
import type { InteractionType } from "../interactions/interactions.schemas.js";

export const DEAL_STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
export const dealStageSchema = z.enum(DEAL_STAGES, {
  error: `Stage must be one of ${DEAL_STAGES.join(", ")}`,
});
export type DealStage = z.output<typeof dealStageSchema>;

export const OPEN_DEAL_STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION"] as const;
export type OpenDealStage = (typeof OPEN_DEAL_STAGES)[number];

export function isOpenStage(stage: DealStage): stage is OpenDealStage {
  return (OPEN_DEAL_STAGES as readonly DealStage[]).includes(stage);
}

const titleSchema = requiredText("Title", 200);

// DECIMAL(12,2) holds at most 10 integer digits and 2 decimals.
export const MAX_DEAL_VALUE = 9_999_999_999.99;

// String(value) avoids exponent forms (1e-7) and float noise (0.1 + 0.2) passing as "2 decimals".
function hasAtMostTwoDecimals(value: number): boolean {
  return /^\d+(\.\d{1,2})?$/.test(String(value));
}

// abort stops at the first failed bound, so a negative value is not also reported as having
// too many decimals.
const dealValueSchema = z
  .number({
    error: (issue) => (issue.input === undefined ? "Value is required" : "Value must be a number"),
  })
  .min(0, { error: "Value must be 0 or more", abort: true })
  .max(MAX_DEAL_VALUE, { error: "Value must be at most 9,999,999,999.99", abort: true })
  .refine(hasAtMostTwoDecimals, { error: "Use at most 2 decimal places" });

// Plain string comparison is valid for YYYY-MM-DD.
const expectedCloseDateSchema = z.iso
  .date({ error: "Enter a valid date (YYYY-MM-DD)" })
  .refine((value) => value >= "1900-01-01", { error: "Date must be on or after 1900-01-01" })
  .nullable()
  .optional();

export const createDealSchema = strictBody({
  title: titleSchema,
  value: dealValueSchema,
  stage: dealStageSchema.default("LEAD"),
  expectedCloseDate: expectedCloseDateSchema,
});

// companyId and closedAt are deliberately absent: a deal cannot be moved between
// companies, and closedAt is derived from stage changes by DealService.
export const updateDealSchema = strictBody({
  title: titleSchema.optional(),
  value: dealValueSchema.optional(),
  stage: dealStageSchema.optional(),
  expectedCloseDate: expectedCloseDateSchema,
}).refine((body) => Object.keys(body).length > 0, {
  message: "At least one field must be provided",
});

// Not strict on purpose: unknown query parameters are ignored.
export const listDealsQuerySchema = paginationQuerySchema.extend({
  stage: dealStageSchema.optional(),
  companyId: z.uuid({ error: "companyId must be a valid UUID" }).optional(),
});

export type CreateDealInput = z.output<typeof createDealSchema>;
export type UpdateDealInput = z.output<typeof updateDealSchema>;
export type ListDealsQuery = z.output<typeof listDealsQuerySchema>;

// What the service hands to the repository: client input plus the derived closedAt.
export type CreateDealData = CreateDealInput & { closedAt: Date | null };
export type UpdateDealData = UpdateDealInput & { closedAt?: Date | null };

export interface DealListFilter {
  companyId?: string;
  stage?: DealStage;
}

// Already the API shape: value is a number and expectedCloseDate a YYYY-MM-DD string.
export interface Deal {
  id: string;
  companyId: string;
  title: string;
  value: number;
  stage: DealStage;
  expectedCloseDate: string | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScoringInteraction {
  type: InteractionType;
  notes: string;
  occurredAt: Date;
}

// What the repository loads for scoring: the deal, its company name and interaction data.
export interface ScoringCandidate {
  deal: Deal;
  companyName: string;
  interactionCount: number;
  recentInteractions: ScoringInteraction[];
}

export type DealWithCompany = Deal & { companyName: string };

export interface PrioritizedDeal {
  deal: DealWithCompany;
  priority: PriorityResult;
}

export type DealNextAction = { dealId: string } & PriorityResult;
