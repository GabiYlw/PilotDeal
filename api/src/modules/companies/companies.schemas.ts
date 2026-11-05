import { z } from "zod";
import { nameSchema, optionalText, strictBody } from "../../shared/validation.js";

const websiteSchema = z
  .url({ protocol: /^https?$/, error: "Enter a valid URL starting with http:// or https://" })
  .max(2048, { error: "Website must be at most 2048 characters" })
  .nullable()
  .optional();

export const createCompanySchema = strictBody({
  name: nameSchema,
  industry: optionalText("Industry", 100),
  website: websiteSchema,
});

export const updateCompanySchema = strictBody({
  name: nameSchema.optional(),
  industry: optionalText("Industry", 100),
  website: websiteSchema,
}).refine((body) => Object.keys(body).length > 0, {
  message: "At least one field must be provided",
});

export type CreateCompanyInput = z.output<typeof createCompanySchema>;
export type UpdateCompanyInput = z.output<typeof updateCompanySchema>;

export interface Company {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
  createdAt: Date;
  updatedAt: Date;
}
