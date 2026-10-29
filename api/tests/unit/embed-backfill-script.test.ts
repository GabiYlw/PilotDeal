import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ runEmbeddingBackfill: vi.fn() }));

vi.mock("dotenv/config", () => ({}));
vi.mock("../../src/config/env.js", () => ({ loadConfig: () => ({ databaseUrl: "x" }) }));
vi.mock("../../src/scripts/run-embedding-backfill.js", () => ({
  runEmbeddingBackfill: mocks.runEmbeddingBackfill,
}));

// The entry script runs on import, so each case imports a fresh copy and waits for the promise chain.
async function runScript(): Promise<void> {
  vi.resetModules();
  await import("../../src/scripts/embed-backfill.js");
  await new Promise((resolve) => setImmediate(resolve));
}

beforeEach(() => {
  process.exitCode = undefined;
  mocks.runEmbeddingBackfill.mockReset();
});

afterEach(() => {
  // A leftover exit code would make the whole test run fail.
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

describe("embed:backfill entry point", () => {
  it.each([
    ["nothing failed", { updated: 3, failed: 0 }, undefined],
    ["nothing was missing", { updated: 0, failed: 0 }, undefined],
    ["some embeddings failed", { updated: 3, failed: 1 }, 1],
  ])("sets the exit code when %s", async (_name, result, expected) => {
    mocks.runEmbeddingBackfill.mockResolvedValue(result);

    await runScript();

    expect(process.exitCode).toBe(expected);
  });

  it("prints the error and sets exit code 1 when the backfill crashes", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const failure = new Error("db down");
    mocks.runEmbeddingBackfill.mockRejectedValue(failure);

    await runScript();

    expect(process.exitCode).toBe(1);
    expect(consoleError).toHaveBeenCalledWith("Embedding backfill failed:", failure);
  });
});
