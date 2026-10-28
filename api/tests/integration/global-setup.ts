import { execSync } from "node:child_process";
import { loadTestConfig } from "./test-env.js";

// Runs once before the integration suite: brings the test database schema up to date.
export default function setup(): void {
  const { databaseUrl } = loadTestConfig();
  try {
    execSync("npx prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "inherit",
    });
  } catch {
    // Prisma already printed the cause above; keep this message short and readable.
    throw new Error(
      "Could not apply migrations to the test database. Is it running? (docker compose up -d db)",
    );
  }
}
