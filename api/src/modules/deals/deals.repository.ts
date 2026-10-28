import type { Deal as DealRow, PrismaClient } from "../../../generated/prisma/client.js";
import { type PageResult, type Pagination, toSkipTake } from "../../shared/pagination.js";
import { isForeignKeyViolation, isRecordNotFoundError } from "../../shared/prisma-errors.js";
import type { CreateDealData, Deal, DealListFilter, UpdateDealData } from "./deals.schemas.js";

export interface DealRepository {
  findById(id: string): Promise<Deal | null>;
  list(filter: DealListFilter, pagination: Pagination): Promise<PageResult<Deal>>;
  /** Returns null when the company no longer exists (foreign key violation). */
  create(companyId: string, data: CreateDealData): Promise<Deal | null>;
  /** Returns null when the deal does not exist. */
  update(id: string, data: UpdateDealData): Promise<Deal | null>;
  /** Returns false when the deal does not exist. */
  delete(id: string): Promise<boolean>;
}

// Prisma returns Decimal (serialized as a string by JSON) and a Date for DATE columns.
// DECIMAL(12,2) round-trips exactly through doubles. Dates are read in UTC to avoid
// shifting the day on machines that are not in UTC.
function toDeal(row: DealRow): Deal {
  return {
    id: row.id,
    companyId: row.companyId,
    title: row.title,
    value: row.value.toNumber(),
    stage: row.stage,
    expectedCloseDate: row.expectedCloseDate
      ? row.expectedCloseDate.toISOString().slice(0, 10)
      : null,
    closedAt: row.closedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toDateColumn(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export class PrismaDealRepository implements DealRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Deal | null> {
    const row = await this.prisma.deal.findUnique({ where: { id } });
    return row ? toDeal(row) : null;
  }

  async list(filter: DealListFilter, pagination: Pagination): Promise<PageResult<Deal>> {
    const where = { companyId: filter.companyId, stage: filter.stage };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.deal.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...toSkipTake(pagination),
      }),
      this.prisma.deal.count({ where }),
    ]);
    return { items: rows.map(toDeal), total };
  }

  async create(companyId: string, data: CreateDealData): Promise<Deal | null> {
    try {
      const row = await this.prisma.deal.create({
        data: { ...data, companyId, expectedCloseDate: toDateColumn(data.expectedCloseDate) },
      });
      return toDeal(row);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        return null;
      }
      throw error;
    }
  }

  async update(id: string, data: UpdateDealData): Promise<Deal | null> {
    try {
      const row = await this.prisma.deal.update({
        where: { id },
        data: { ...data, expectedCloseDate: toDateColumn(data.expectedCloseDate) },
      });
      return toDeal(row);
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.deal.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }
}
