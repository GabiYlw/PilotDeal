import { z } from "zod";

// Treat empty strings (for example "ANTHROPIC_API_KEY=" in .env) as "not set".
const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().optional(),
);

const optionalBoolean = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
);

const embeddingEnvSchema = z.object({
  EMBEDDING_CACHE_DIR: optionalString,
  EMBEDDING_OFFLINE: optionalBoolean,
});

const envSchema = embeddingEnvSchema.extend({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  DATABASE_URL_TEST: optionalString,
  PORT: z.coerce.number().int().positive().default(3001),
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: z.string().min(1).default("claude-haiku-5-5"),
});

// Where the local embedding model is cached, and whether it may be downloaded.
// The Docker image downloads the model at build time and sets offline to true.
export interface EmbeddingSettings {
  cacheDir: string | undefined;
  offline: boolean;
}

export interface Config {
  databaseUrl: string;
  databaseUrlTest: string | undefined;
  port: number;
  anthropicApiKey: string | undefined;
  anthropicModel: string;
  embedding: EmbeddingSettings;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = parseEnv(envSchema, env);
  return {
    databaseUrl: parsed.DATABASE_URL,
    databaseUrlTest: parsed.DATABASE_URL_TEST,
    port: parsed.PORT,
    anthropicApiKey: parsed.ANTHROPIC_API_KEY,
    anthropicModel: parsed.ANTHROPIC_MODEL,
    embedding: toEmbeddingSettings(parsed),
  };
}

// For scripts that only need the embedding model (no database), such as the model download.
export function loadEmbeddingSettings(env: NodeJS.ProcessEnv = process.env): EmbeddingSettings {
  return toEmbeddingSettings(parseEnv(embeddingEnvSchema, env));
}

function toEmbeddingSettings(parsed: z.infer<typeof embeddingEnvSchema>): EmbeddingSettings {
  return { cacheDir: parsed.EMBEDDING_CACHE_DIR, offline: parsed.EMBEDDING_OFFLINE };
}

function parseEnv<Schema extends z.ZodType>(
  schema: Schema,
  env: NodeJS.ProcessEnv,
): z.infer<Schema> {
  const result = schema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
