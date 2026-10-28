import { z } from "zod";

// Health takes no input, so this module only defines its response shape.
// Other modules put their zod request schemas (body, query, params) here.
export const healthStatusSchema = z.object({
  status: z.enum(["ok", "error"]),
  database: z.enum(["up", "down"]),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;
