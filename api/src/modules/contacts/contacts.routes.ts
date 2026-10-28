import { Router } from "express";
import type { ContactController } from "./contacts.controller.js";

// Mounted at /companies/:companyId/contacts.
export function createCompanyContactsRouter(controller: ContactController): Router {
  const router = Router({ mergeParams: true });
  router.get("/", controller.listCompanyContacts);
  router.post("/", controller.createCompanyContact);
  return router;
}

// Mounted at /contacts.
export function createContactsRouter(controller: ContactController): Router {
  const router = Router();
  router.get("/:id", controller.getContact);
  router.patch("/:id", controller.updateContact);
  router.delete("/:id", controller.deleteContact);
  return router;
}
