import type { Request, Response } from "express";
import { INVALID_BODY_MESSAGE, parseOrThrow } from "../../shared/validation.js";
import { askRequestSchema } from "./ask.schemas.js";
import type { AskService } from "./ask.service.js";

export class AskController {
  constructor(private readonly askService: AskService) {}

  // 200, not 201: nothing is created.
  ask = async (req: Request, res: Response): Promise<void> => {
    const input = parseOrThrow(askRequestSchema, req.body, INVALID_BODY_MESSAGE);
    res.status(200).json(await this.askService.ask(input));
  };
}
