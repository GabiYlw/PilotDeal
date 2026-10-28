import type { HealthRepository } from "./health.repository.js";
import type { HealthStatus } from "./health.schemas.js";

export class HealthService {
  constructor(private readonly healthRepository: HealthRepository) {}

  async getStatus(): Promise<HealthStatus> {
    try {
      await this.healthRepository.ping();
      return { status: "ok", database: "up" };
    } catch (error) {
      console.warn("Health check: database ping failed", error);
      return { status: "error", database: "down" };
    }
  }
}
