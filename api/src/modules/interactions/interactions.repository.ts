import type { PrismaClient } from "../../../generated/prisma/client.js";
import { type PageResult, type Pagination, toSkipTake } from "../../shared/pagination.js";
import { isForeignKeyViolation, isRecordNotFoundError } from "../../shared/prisma-errors.js";
import type {
  CreateInteractionInput,
  Interaction,
  UpdateInteractionInput,
} from "./interactions.schemas.js";

export interface InteractionRepository {
  findById(id: string): Promise<Interaction | null>;
  listByDeal(dealId: string, pagination: Pagination): Promise<PageResult<Interaction>>;
  /** Returns null when the deal no longer exists (foreign key violation). */
  create(dealId: string, input: CreateInteractionInput): Promise<Interaction | null>;
  /** Returns null when the interaction does not exist. */
  update(id: string, input: UpdateInteractionInput): Promise<Interaction | null>;
  /** Returns false when the interaction does not exist. */
  delete(id: string): Promise<boolean>;
}

export class PrismaInteractionRepository implements InteractionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string): Promise<Interaction | null> {
    return this.prisma.interaction.findUnique({ where: { id } });
  }

  async listByDeal(dealId: string, pagination: Pagination): Promise<PageResult<Interaction>> {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.interaction.findMany({
        where: { dealId },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        ...toSkipTake(pagination),
      }),
      this.prisma.interaction.count({ where: { dealId } }),
    ]);
    return { items, total };
  }

  async create(dealId: string, input: CreateInteractionInput): Promise<Interaction | null> {
    try {
      // An omitted occurredAt uses the database default (now).
      return await this.prisma.interaction.create({ data: { ...input, dealId } });
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        return null;
      }
      throw error;
    }
  }

  async update(id: string, input: UpdateInteractionInput): Promise<Interaction | null> {
    try {
      return await this.prisma.interaction.update({ where: { id }, data: input });
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return null;
      }
      throw error;
    }
  }

  async delete(id: string): Promise<boolean> {
    try {
      await this.prisma.interaction.delete({ where: { id } });
      return true;
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        return false;
      }
      throw error;
    }
  }
}
