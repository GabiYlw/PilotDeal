import { z } from "zod";
import { paginationQuerySchema } from "../../shared/pagination.js";

export const DEAL_STAGES = ["LEAD", "QUALIFIED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"] as const;
export const dealStageSchema = z.enum(DEAL_STAGES);
export type DealStage = z.output<typeof dealStageSchema>;

const titleSchema = z.string().trim().min(1).max(200);

// DECIMAL(12,2) holds at most 10 integer digits and 2 decimals.
export const MAX_DEAL_VALUE = 9_999_999_999.99;

// String(value) avoids exponent forms (1e-7) and float noise (0.1 + 0.2) passing as "2 decimals".
function hasAtMostTwoDecimals(value: number): boolean {
  return /^\d+(\.\d{1,2})?$/.test(String(value));
}

const dealValueSchema = z
  .number()
  .min(0)
  .max(MAX_DEAL_VALUE)
  .refine(hasAtMostTwoDecimals, { message: "Value must have at most 2 decimal places" });

// Plain string comparison is valid for YYYY-MM-DD.
const expectedCloseDateSchema = z.iso
  .date()
  .refine((value) => value >= "1900-01-01", { message: "Date must be on or after 1900-01-01" })
  .nullable()
  .optional();

export const createDealSchema = z.strictObject({
  title: titleSchema,
  value: dealValueSchema,
  stage: dealStageSchema.default("LEAD"),
  expectedCloseDate: expectedCloseDateSchema,
});

// companyId and closedAt are deliberately absent: a deal cannot be moved between
// companies, and closedAt is derived from stage changes by DealService.
export const updateDealSchema = z
  .strictObject({
    title: titleSchema.optional(),
    value: dealValueSchema.optional(),
    stage: dealStageSchema.optional(),
    expectedCloseDate: expectedCloseDateSchema,
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });

// Not strict on purpose: unknown query parameters are ignored.
export const listDealsQuerySchema = paginationQuerySchema.extend({
  stage: dealStageSchema.optional(),
  companyId: z.uuid().optional(),
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
