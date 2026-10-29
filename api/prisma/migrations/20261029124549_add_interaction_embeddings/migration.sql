-- AlterTable
ALTER TABLE "Interaction" ADD COLUMN "embedding" vector(384);

-- Added by hand: Prisma cannot model HNSW indexes. Cosine distance (<=>) matches the /ask search.
CREATE INDEX "Interaction_embedding_hnsw_idx" ON "Interaction" USING hnsw ("embedding" vector_cosine_ops);
