import { describe, expect, it, vi } from "vitest";
import type { HealthRepository } from "../../src/modules/health/health.repository.js";
import { HealthService } from "../../src/modules/health/health.service.js";

function createRepository(ping: HealthRepository["ping"]): HealthRepository {
  return { ping: vi.fn(ping) };
}

describe("HealthService", () => {
  it("reports ok and database up when the database answers", async () => {
    const service = new HealthService(createRepository(() => Promise.resolve()));

    await expect(service.getStatus()).resolves.toEqual({ status: "ok", database: "up" });
  });

  it("reports error and database down when the database ping fails", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const service = new HealthService(
      createRepository(() => Promise.reject(new Error("connection refused"))),
    );

    await expect(service.getStatus()).resolves.toEqual({ status: "error", database: "down" });
  });
});
