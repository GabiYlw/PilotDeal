import { z } from "zod";
import { nameSchema, optionalText } from "../../shared/validation.js";

const emailSchema = z.email().max(320).nullable().optional();

export const createContactSchema = z.strictObject({
  name: nameSchema,
  email: emailSchema,
  phone: optionalText(50),
  role: optionalText(100),
});

// companyId is deliberately absent: a contact cannot be moved between companies.
export const updateContactSchema = z
  .strictObject({
    name: nameSchema.optional(),
    email: emailSchema,
    phone: optionalText(50),
    role: optionalText(100),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "At least one field must be provided",
  });

export const companyIdParamsSchema = z.object({ companyId: z.uuid() });

export type CreateContactInput = z.output<typeof createContactSchema>;
export type UpdateContactInput = z.output<typeof updateContactSchema>;

export interface Contact {
  id: string;
  companyId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  createdAt: Date;
  updatedAt: Date;
}
