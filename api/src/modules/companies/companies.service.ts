import { NotFoundError } from "../../shared/errors.js";
import { type Paginated, type Pagination, toPaginated } from "../../shared/pagination.js";
import type { CompanyRepository } from "./companies.repository.js";
import type { Company, CreateCompanyInput, UpdateCompanyInput } from "./companies.schemas.js";

export class CompanyService {
  constructor(private readonly companyRepository: CompanyRepository) {}

  async list(pagination: Pagination): Promise<Paginated<Company>> {
    return toPaginated(await this.companyRepository.list(pagination), pagination);
  }

  async getById(id: string): Promise<Company> {
    const company = await this.companyRepository.findById(id);
    if (!company) {
      throw new NotFoundError(`Company ${id} not found`);
    }
    return company;
  }

  create(input: CreateCompanyInput): Promise<Company> {
    return this.companyRepository.create(input);
  }

  async update(id: string, input: UpdateCompanyInput): Promise<Company> {
    const company = await this.companyRepository.update(id, input);
    if (!company) {
      throw new NotFoundError(`Company ${id} not found`);
    }
    return company;
  }

  async delete(id: string): Promise<void> {
    const deleted = await this.companyRepository.delete(id);
    if (!deleted) {
      throw new NotFoundError(`Company ${id} not found`);
    }
  }
}
