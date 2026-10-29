import type { PrismaClient } from "../../../generated/prisma/client.js";
import { toVectorLiteral } from "../../shared/pgvector.js";
import type { InteractionSearchQuery, InteractionSearchRow } from "./ask.schemas.js";

export interface AskRepository {
  /** Interactions closest to the embedding by cosine distance, nearest first. Rows without an embedding are skipped. */
  searchInteractions(query: InteractionSearchQuery): Promise<InteractionSearchRow[]>;
}

export class PrismaAskRepository implements AskRepository {
  constructor(private readonly prisma: PrismaClient) {}

  searchInteractions(query: InteractionSearchQuery): Promise<InteractionSearchRow[]> {
    const vector = toVectorLiteral(query.embedding);
    // The threshold is a distance (<=), not "1 - distance >= min": a zero-norm vector gives NaN,
    // NaN sorts above every number, so NaN <= x is false (excluded) while 1 - NaN >= x would be true.
    return this.prisma.$queryRaw<InteractionSearchRow[]>`
      SELECT
        i."id"            AS "interactionId",
        i."dealId"        AS "dealId",
        d."title"         AS "dealTitle",
        c."name"          AS "companyName",
        i."type"::text    AS "type",
        i."notes"         AS "notes",
        i."occurredAt"    AS "occurredAt",
        1 - (i."embedding" <=> ${vector}::vector) AS "similarity"
      FROM "Interaction" i
      JOIN "Deal" d ON d."id" = i."dealId"
      JOIN "Company" c ON c."id" = d."companyId"
      WHERE i."embedding" IS NOT NULL
        AND (${query.dealId}::uuid IS NULL OR i."dealId" = ${query.dealId}::uuid)
        AND (i."embedding" <=> ${vector}::vector) <= ${query.maxDistance}
      ORDER BY i."embedding" <=> ${vector}::vector ASC, i."id" ASC
      LIMIT ${query.limit}
    `;
  }
}
