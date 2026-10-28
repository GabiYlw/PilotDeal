import { z } from "zod";

// Treat empty strings (for example "ANTHROPIC_API_KEY=" in .env) as "not set".
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DATABASE_URL_TEST: optionalString,
  PORT: z.coerce.number().int().positive().default(3001),
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: z.string().min(1).default("claude-haiku-5-5"),
});

export interface Config {
  databaseUrl: string;
  databaseUrlTest: string | undefined;
  port: number;
  anthropicApiKey: string | undefined;
  anthropicModel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }

  const parsed = result.data;
  return {
    databaseUrl: parsed.DATABASE_URL,
    databaseUrlTest: parsed.DATABASE_URL_TEST,
    port: parsed.PORT,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
    anthropicModel: parsed.ANTHROPIC_MODEL,
  };
}
