import type { PrismaClient } from "../../../generated/prisma/client.js";
import { type PageResult, type Pagination, toSkipTake } from "../../shared/pagination.js";
import { isForeignKeyViolation, isRecordNotFoundError } from "../../shared/prisma-errors.js";
import type { Contact, CreateContactInput, UpdateContactInput } from "./contacts.schemas.js";

export interface ContactRepository {
  findById(id: string): Promise<Contact | null>;
  listByCompany(companyId: string, pagination: Pagination): Promise<PageResult<Contact>>;
  /** Returns null when the company no longer exists (foreign key violation). */
  create(companyId: string, input: CreateContactInput): Promise<Contact | null>;
  /** Returns null when the contact does not exist. */
  update(id: string, input: UpdateContactInput): Promise<Contact | null>;
  /** Returns false when the contact does not exist. */
  delete(id: string): Promise<boolean>;
}

export class PrismaContactRepository implements ContactRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<Contact | null> {
    return this.prisma.contact.findUnique({ where: { id } });
  }

  async listByCompany(companyId: string, pagination: Pagination): Promise<PageResult<Contact>> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.contact.findMany({
        where: { companyId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...toSkipTake(pagination),
      }),
      this.prisma.contact.count({ where: { companyId } }),
    ]);
    return { items, total };
  }

  async create(companyId: string, input: CreateContactInput): Promise<Contact | null> {
    try {
      return await this.prisma.contact.create({ data: { ...input, companyId } });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        return null;
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateContactInput): Promise<Contact | null> {
    try {
      return await this.prisma.contact.update({ where: { id }, data: input });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.contact.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }
}
