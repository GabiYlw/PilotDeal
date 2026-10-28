import type { Request, Response } from "express";
import { paginationQuerySchema } from "../../shared/pagination.js";
import {
  INVALID_BODY_MESSAGE,
  INVALID_PARAMS_MESSAGE,
  INVALID_QUERY_MESSAGE,
  companyIdParamsSchema,
  idParamsSchema,
  parseOrThrow,
} from "../../shared/validation.js";
import { createDealSchema, listDealsQuerySchema, updateDealSchema } from "./deals.schemas.js";
import type { DealService } from "./deals.service.js";

export class DealController {
  constructor(private readonly dealService: DealService) {}

  listCompanyDeals = async (req: Request, res: Response): Promise<void> => {
    const { companyId } = parseOrThrow(companyIdParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    const pagination = parseOrThrow(paginationQuerySchema, req.query, INVALID_QUERY_MESSAGE);
    res.status(200).json(await this.dealService.listForCompany(companyId, pagination));
  };

  createCompanyDeal = async (req: Request, res: Response): Promise<void> => {
    const { companyId } = parseOrThrow(companyIdParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    const input = parseOrThrow(createDealSchema, req.body, INVALID_BODY_MESSAGE);
    res.status(201).json(await this.dealService.createForCompany(companyId, input));
  };

  listDeals = async (req: Request, res: Response): Promise<void> => {
    const { page, pageSize, ...filter } = parseOrThrow(
      listDealsQuerySchema,
      req.query,
      INVALID_QUERY_MESSAGE,
    );
    res.status(200).json(await this.dealService.list(filter, { page, pageSize }));
  };

  getDeal = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(idParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    res.status(200).json(await this.dealService.getById(id));
  };

  updateDeal = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(idParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    const input = parseOrThrow(updateDealSchema, req.body, INVALID_BODY_MESSAGE);
    res.status(200).json(await this.dealService.update(id, input));
  };

  deleteDeal = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(idParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    await this.dealService.delete(id);
    res.status(204).end();
  };
}
