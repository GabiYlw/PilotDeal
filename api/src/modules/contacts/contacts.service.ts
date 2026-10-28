import { NotFoundError } from "../../shared/errors.js";
import { type Paginated, type Pagination, toPaginated } from "../../shared/pagination.js";
import type { CompanyRepository } from "../companies/companies.repository.js";
import type { ContactRepository } from "./contacts.repository.js";
import type { Contact, CreateContactInput, UpdateContactInput } from "./contacts.schemas.js";

export class ContactService {
  constructor(
    private readonly contactRepository: ContactRepository,
    private readonly companyRepository: CompanyRepository,
  ) {}

  async listForCompany(companyId: string, pagination: Pagination): Promise<Paginated<Contact>> {
    await this.ensureCompanyExists(companyId);
    return toPaginated(
      await this.contactRepository.listByCompany(companyId, pagination),
      pagination,
    );
  }

  async createForCompany(companyId: string, input: CreateContactInput): Promise<Contact> {
    await this.ensureCompanyExists(companyId);
    const contact = await this.contactRepository.create(companyId, input);
    if (!contact) {
      // The company was deleted between the check and the insert.
      throw companyNotFound(companyId);
    }
    return contact;
  }

  async getById(id: string): Promise<Contact> {
    const contact = await this.contactRepository.findById(id);
    if (!contact) {
      throw contactNotFound(id);
    }
    return contact;
  }

  async update(id: string, input: UpdateContactInput): Promise<Contact> {
    const contact = await this.contactRepository.update(id, input);
    if (!contact) {
      throw contactNotFound(id);
    }
    return contact;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.contactRepository.delete(id);
    if (!deleted) {
      throw contactNotFound(id);
    }
  }

  private async ensureCompanyExists(companyId: string): Promise<void> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw companyNotFound(companyId);
    }
  }
}

function companyNotFound(companyId: string): NotFoundError {
  return new NotFoundError(`Company ${companyId} not found`);
}

function contactNotFound(id: string): NotFoundError {
  return new NotFoundError(`Contact ${id} not found`);
}
