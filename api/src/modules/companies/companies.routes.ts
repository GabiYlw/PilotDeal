import { Router } from "express";
import type { CompanyController } from "./companies.controller.js";

export function createCompaniesRouter(controller: CompanyController): Router {
  const router = Router();
  router.get("/", controller.listCompanies);
  router.post("/", controller.createCompany);
  router.get("/:id", controller.getCompany);
  router.patch("/:id", controller.updateCompany);
  router.delete("/:id", controller.deleteCompany);
  return router;
}
