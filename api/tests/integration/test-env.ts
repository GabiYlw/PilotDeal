import "dotenv/config";
import { loadConfig, type Config } from "../../src/config/env.js";

// Config for integration tests: always points at DATABASE_URL_TEST, never the dev database.
export function loadTestConfig(): Config {
  const config = loadConfig();
  const testUrl = config.databaseUrlTest;
  if (!testUrl) {
    throw new Error("DATABASE_URL_TEST must be set to run integration tests");
  }
  if (testUrl === config.databaseUrl) {
    throw new Error("DATABASE_URL_TEST must differ from DATABASE_URL");
  }
  return { ...config, databaseUrl: testUrl };
}
