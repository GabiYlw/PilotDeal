import type { Request, Response } from "express";
import type { HealthService } from "./health.service.js";

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // Arrow function so `this` stays bound when Express calls it as a handler.
  getHealth = async (_req: Request, res: Response): Promise<void> => {
    const health = await this.healthService.getStatus();
    res.status(health.database === "up" ? 200 : 503).json(health);
  };
}
