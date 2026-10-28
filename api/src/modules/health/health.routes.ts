import { Router } from "express";
import type { HealthController } from "./health.controller.js";

export function createHealthRouter(healthController: HealthController): Router {
  const router = Router();
  router.get("/", healthController.getHealth);
  return router;
}
