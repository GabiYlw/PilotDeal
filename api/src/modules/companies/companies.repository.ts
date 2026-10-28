import type { PrismaClient } from "../../../generated/prisma/client.js";
import { type PageResult, type Pagination, toSkipTake } from "../../shared/pagination.js";
import { isRecordNotFoundError } from "../../shared/prisma-errors.js";
import type { Company, CreateCompanyInput, UpdateCompanyInput } from "./companies.schemas.js";

export interface CompanyRepository {
  findById(id: string): Promise<Company | null>;
  list(pagination: Pagination): Promise<PageResult<Company>>;
  create(input: CreateCompanyInput): Promise<Company>;
  /** Returns null when the company does not exist. */
  update(id: string, input: UpdateCompanyInput): Promise<Company | null>;
  /** Returns false when the company does not exist. */
  delete(id: string): Promise<boolean>;
}

export class PrismaCompanyRepository implements CompanyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<Company | null> {
    return this.prisma.company.findUnique({ where: { id } });
  }

  async list(pagination: Pagination): Promise<PageResult<Company>> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.company.findMany({
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...toSkipTake(pagination),
      }),
      this.prisma.company.count(),
    ]);
    return { items, total };
  }

  create(input: CreateCompanyInput): Promise<Company> {
    return this.prisma.company.create({ data: input });
  }

  async update(id: string, input: UpdateCompanyInput): Promise<Company | null> {
    try {
      return await this.prisma.company.update({ where: { id }, data: input });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.company.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }
}
