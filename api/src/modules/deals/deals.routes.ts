import { Router } from "express";
import type { DealController } from "./deals.controller.js";

// Mounted at /companies/:companyId/deals.
export function createCompanyDealsRouter(controller: DealController): Router {
  const router = Router({ mergeParams: true });
  router.get("/", controller.listCompanyDeals);
  router.post("/", controller.createCompanyDeal);
  return router;
}

// Mounted at /deals.
export function createDealsRouter(controller: DealController): Router {
  const router = Router();
  router.get("/", controller.listDeals);
  router.get("/:id", controller.getDeal);
  router.patch("/:id", controller.updateDeal);
  router.delete("/:id", controller.deleteDeal);
  return router;
}
