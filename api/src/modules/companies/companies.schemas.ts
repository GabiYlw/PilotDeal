import { z } from "zod";
import { nameSchema, optionalText } from "../../shared/validation.js";

const websiteSchema = z.url({ protocol: /^https?$/ }).max(2048).nullable().optional();

export const createCompanySchema = z.strictObject({
  name: nameSchema,
  industry: optionalText(100),
  website: websiteSchema,
});

export const updateCompanySchema = z
  .strictObject({
    name: nameSchema.optional(),
    industry: optionalText(100),
    website: websiteSchema,
  })
  .refine((body) => Object.keys(body).length > 0, {
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
