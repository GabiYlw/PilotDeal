import { z } from "zod";
import { nameSchema, optionalText, strictBody } from "../../shared/validation.js";

const emailSchema = z
  .email({ error: "Enter a valid email address" })
  .max(320, { error: "Email must be at most 320 characters" })
  .nullable()
  .optional();

export const createContactSchema = strictBody({
  name: nameSchema,
  email: emailSchema,
  phone: optionalText("Phone", 50),
  role: optionalText("Role", 100),
});

// companyId is deliberately absent: a contact cannot be moved between companies.
export const updateContactSchema = strictBody({
  name: nameSchema.optional(),
  email: emailSchema,
  phone: optionalText("Phone", 50),
  role: optionalText("Role", 100),
}).refine((body) => Object.keys(body).length > 0, {
  message: "At least one field must be provided",
});

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
