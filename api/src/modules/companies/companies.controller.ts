import type { Request, Response } from "express";
import { paginationQuerySchema } from "../../shared/pagination.js";
import {
  INVALID_BODY_MESSAGE,
  INVALID_PARAMS_MESSAGE,
  INVALID_QUERY_MESSAGE,
  idParamsSchema,
  parseOrThrow,
} from "../../shared/validation.js";
import { createCompanySchema, updateCompanySchema } from "./companies.schemas.js";
import type { CompanyService } from "./companies.service.js";

export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  listCompanies = async (req: Request, res: Response): Promise<void> => {
    const pagination = parseOrThrow(paginationQuerySchema, req.query, INVALID_QUERY_MESSAGE);
    res.status(200).json(await this.companyService.list(pagination));
  };

  createCompany = async (req: Request, res: Response): Promise<void> => {
    const input = parseOrThrow(createCompanySchema, req.body, INVALID_BODY_MESSAGE);
    res.status(201).json(await this.companyService.create(input));
  };

  getCompany = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(idParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    res.status(200).json(await this.companyService.getById(id));
  };

  updateCompany = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(idParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    const input = parseOrThrow(updateCompanySchema, req.body, INVALID_BODY_MESSAGE);
    res.status(200).json(await this.companyService.update(id, input));
  };

  deleteCompany = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(idParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    await this.companyService.delete(id);
    res.status(204).end();
  };
}
