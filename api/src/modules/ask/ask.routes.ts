import { Router } from "express";
import type { AskController } from "./ask.controller.js";

// Mounted at /ask.
export function createAskRouter(controller: AskController): Router {
  const router = Router();
  router.post("/", controller.ask);
  return router;
}
