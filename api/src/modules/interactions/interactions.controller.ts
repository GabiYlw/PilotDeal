import type { Request, Response } from "express";
import { paginationQuerySchema } from "../../shared/pagination.js";
import {
  INVALID_BODY_MESSAGE,
  INVALID_PARAMS_MESSAGE,
  INVALID_QUERY_MESSAGE,
  dealIdParamsSchema,
  idParamsSchema,
  parseOrThrow,
} from "../../shared/validation.js";
import { createInteractionSchema, updateInteractionSchema } from "./interactions.schemas.js";
import type { InteractionService } from "./interactions.service.js";

export class InteractionController {
  constructor(private readonly interactionService: InteractionService) {}

  listDealInteractions = async (req: Request, res: Response): Promise<void> => {
    const { dealId } = parseOrThrow(dealIdParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    const pagination = parseOrThrow(paginationQuerySchema, req.query, INVALID_QUERY_MESSAGE);
    res.status(200).json(await this.interactionService.listForDeal(dealId, pagination));
  };

  createDealInteraction = async (req: Request, res: Response): Promise<void> => {
    const { dealId } = parseOrThrow(dealIdParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    const input = parseOrThrow(createInteractionSchema, req.body, INVALID_BODY_MESSAGE);
    res.status(201).json(await this.interactionService.createForDeal(dealId, input));
  };

  getInteraction = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(idParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    res.status(200).json(await this.interactionService.getById(id));
  };

  updateInteraction = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(idParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    const input = parseOrThrow(updateInteractionSchema, req.body, INVALID_BODY_MESSAGE);
    res.status(200).json(await this.interactionService.update(id, input));
  };

  deleteInteraction = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(idParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    await this.interactionService.delete(id);
    res.status(204).end();
  };
}
