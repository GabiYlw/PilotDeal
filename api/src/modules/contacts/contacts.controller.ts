import type { Request, Response } from "express";
import { paginationQuerySchema } from "../../shared/pagination.js";
import {
  INVALID_BODY_MESSAGE,
  INVALID_PARAMS_MESSAGE,
  INVALID_QUERY_MESSAGE,
  idParamsSchema,
  parseOrThrow,
} from "../../shared/validation.js";
import {
  companyIdParamsSchema,
  createContactSchema,
  updateContactSchema,
} from "./contacts.schemas.js";
import type { ContactService } from "./contacts.service.js";

export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  listCompanyContacts = async (req: Request, res: Response): Promise<void> => {
    const { companyId } = parseOrThrow(companyIdParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    const pagination = parseOrThrow(paginationQuerySchema, req.query, INVALID_QUERY_MESSAGE);
    res.status(200).json(await this.contactService.listForCompany(companyId, pagination));
  };

  createCompanyContact = async (req: Request, res: Response): Promise<void> => {
    const { companyId } = parseOrThrow(companyIdParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    const input = parseOrThrow(createContactSchema, req.body, INVALID_BODY_MESSAGE);
    res.status(201).json(await this.contactService.createForCompany(companyId, input));
  };

  getContact = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(idParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    res.status(200).json(await this.contactService.getById(id));
  };

  updateContact = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(idParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    const input = parseOrThrow(updateContactSchema, req.body, INVALID_BODY_MESSAGE);
    res.status(200).json(await this.contactService.update(id, input));
  };

  deleteContact = async (req: Request, res: Response): Promise<void> => {
    const { id } = parseOrThrow(idParamsSchema, req.params, INVALID_PARAMS_MESSAGE);
    await this.contactService.delete(id);
    res.status(204).end();
  };
}
