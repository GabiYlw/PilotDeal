import express, { type Express } from "express";
import type { Controllers } from "./container.js";
import { createAskRouter } from "./modules/ask/ask.routes.js";
import { createCompaniesRouter } from "./modules/companies/companies.routes.js";
import {
  createCompanyContactsRouter,
  createContactsRouter,
} from "./modules/contacts/contacts.routes.js";
import { createCompanyDealsRouter, createDealsRouter } from "./modules/deals/deals.routes.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import {
  createDealInteractionsRouter,
  createInteractionsRouter,
} from "./modules/interactions/interactions.routes.js";
import { errorMiddleware, notFoundHandler } from "./shared/error-middleware.js";

// Builds the Express app without listening, so tests can import it.
export function createApp(controllers: Controllers): Express {
  const app = express();
  app.use(express.json());

  app.use("/health", createHealthRouter(controllers.healthController));
  app.use(
    "/companies/:companyId/contacts",
    createCompanyContactsRouter(controllers.contactController),
  );
  app.use("/companies/:companyId/deals", createCompanyDealsRouter(controllers.dealController));
  app.use("/companies", createCompaniesRouter(controllers.companyController));
  app.use("/contacts", createContactsRouter(controllers.contactController));
  app.use(
    "/deals/:dealId/interactions",
    createDealInteractionsRouter(controllers.interactionController),
  );
  app.use("/deals", createDealsRouter(controllers.dealController));
  app.use("/interactions", createInteractionsRouter(controllers.interactionController));
  app.use("/ask", createAskRouter(controllers.askController));

  app.use(notFoundHandler);
  app.use(errorMiddleware);
  return app;
}
