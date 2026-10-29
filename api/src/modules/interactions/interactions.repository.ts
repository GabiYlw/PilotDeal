import type { PrismaClient } from "../../../generated/prisma/client.js";
import { type PageResult, type Pagination, toSkipTake } from "../../shared/pagination.js";
import { toVectorLiteral } from "../../shared/pgvector.js";
import { isForeignKeyViolation, isRecordNotFoundError } from "../../shared/prisma-errors.js";
import type {
  CreateInteractionInput,
  EmbeddableInteraction,
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
  /** Writes the vector only if the row still has exactly these notes. Returns true if a row was updated. */
  saveEmbedding(id: string, notes: string, embedding: number[]): Promise<boolean>;
  /** Sets embedding to NULL only if the row still has exactly these notes. Returns true if a row was updated. */
  clearEmbedding(id: string, notes: string): Promise<boolean>;
  /** Interactions whose embedding is NULL, with id > afterId (null = from the start), ordered by id, at most `limit`. */
  listMissingEmbeddings(afterId: string | null, limit: number): Promise<EmbeddableInteraction[]>;
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

  // Prisma cannot write Unsupported columns, so the vector is written with raw SQL.
  // The "notes" condition is a compare-and-set: if the notes changed while the vector was being
  // computed, the stale vector is not stored. Raw updates do not touch updatedAt.
  async saveEmbedding(id: string, notes: string, embedding: number[]): Promise<boolean> {
    const count = await this.prisma.$executeRaw`
      UPDATE "Interaction"
      SET "embedding" = ${toVectorLiteral(embedding)}::vector
      WHERE "id" = ${id}::uuid AND "notes" = ${notes}
    `;
    return count > 0;
  }

  async clearEmbedding(id: string, notes: string): Promise<boolean> {
    const count = await this.prisma.$executeRaw`
      UPDATE "Interaction"
      SET "embedding" = NULL
      WHERE "id" = ${id}::uuid AND "notes" = ${notes}
    `;
    return count > 0;
  }

  // Keyset pagination (id > afterId) so a backfill terminates even if some rows stay NULL.
  listMissingEmbeddings(afterId: string | null, limit: number): Promise<EmbeddableInteraction[]> {
    return this.prisma.$queryRaw<EmbeddableInteraction[]>`
      SELECT "id", "notes"
      FROM "Interaction"
      WHERE "embedding" IS NULL
        AND (${afterId}::uuid IS NULL OR "id" > ${afterId}::uuid)
      ORDER BY "id" ASC
      LIMIT ${limit}
    `;
  }
}
