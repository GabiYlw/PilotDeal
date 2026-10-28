import { Router } from "express";
import type { InteractionController } from "./interactions.controller.js";

// Mounted at /deals/:dealId/interactions.
export function createDealInteractionsRouter(controller: InteractionController): Router {
  const router = Router({ mergeParams: true });
  router.get("/", controller.listDealInteractions);
  router.post("/", controller.createDealInteraction);
  return router;
}

// Mounted at /interactions.
export function createInteractionsRouter(controller: InteractionController): Router {
  const router = Router();
  router.get("/:id", controller.getInteraction);
  router.patch("/:id", controller.updateInteraction);
  router.delete("/:id", controller.deleteInteraction);
  return router;
}
