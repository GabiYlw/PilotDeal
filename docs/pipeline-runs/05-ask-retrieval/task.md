# Task (verbatim from the user)

Add semantic search over interaction notes for "Ask your CRM" (retrieval
only). Follow CLAUDE.md. Do not generate answers with the LLM yet: this task
returns the relevant interactions, and answer generation comes in a later task.

Embeddings:
- src/ai/embedding-provider.ts: interface EmbeddingProvider with
  embed(texts: string[]): Promise<number[][]> and a dimensions property (384).
- LocalEmbeddingProvider using @huggingface/transformers with
  Xenova/all-MiniLM-L6-v2, feature-extraction with mean pooling and
  normalization. The model loads lazily on first use and only once, even under
  concurrent calls. Explain the new dependency in implementation.md.
- Wire it in container.ts through the interface.

Storage:
- Migration add_interaction_embeddings: a nullable embedding vector(384) column
  on Interaction (Prisma Unsupported type) and an HNSW index using
  vector_cosine_ops. Create it with the migrate command plus --create-only, add
  the index SQL by hand, then apply it.
- All vector reads and writes happen in a repository, with parameterized
  $executeRaw / $queryRaw only.

When embeddings are computed:
- On interaction create, and on PATCH when notes change (not when only type or
  occurredAt change).
- If embedding fails, the interaction is still saved with a null embedding and
  a warning is logged (inject the existing Logger). The request does not fail.
- New script "embed:backfill" in api/package.json: embeds every interaction
  with a null embedding, in batches, and prints how many it updated.
- The seed runs the backfill at the end, so seeded data is searchable.
  Add the embed:backfill command to the Commands table in CLAUDE.md.

Endpoint POST /ask:
- Body: { question: string (trimmed, 3 to 500 chars), dealId?: UUID,
  limit?: integer 1 to 10, default 5 }. Unknown fields rejected.
- dealId limits the search to that deal's interactions; 404 if the deal does
  not exist.
- Embed the question, return the most similar interactions by cosine
  similarity, skipping interactions without an embedding and any result below
  a minimum similarity of 0.25 (a named constant).
- Response: { answer: null, answeredBy: "none", sources: [{ interactionId,
  dealId, dealTitle, companyName, type, occurredAt, excerpt (first 300 chars of
  the notes), similarity (0 to 1, rounded to 3 decimals) }] }, ordered by
  similarity desc. answer and answeredBy are placeholders for the next task.
- No matching notes: 200 with an empty sources array.

Tests (never download the real model):
- A FakeEmbeddingProvider for tests that builds deterministic vectors from a
  small keyword vocabulary (for example price, budget, timeline, delay, contract,
  competitor), so tests control which notes are similar to a question.
- LocalEmbeddingProvider: with the transformers pipeline mocked, check the
  pooling and normalize options, 384-length output, and that the model is
  loaded only once across concurrent calls.
- Interactions: embedding stored on create, recomputed when notes change, kept
  when only other fields change, and create still succeeds with a null
  embedding when the provider throws.
- Backfill: fills only missing embeddings and reports the count.
- POST /ask integration: ordering by similarity, the 0.25 threshold, the limit,
  dealId scoping, 404 for a missing deal, validation errors (table-driven), and
  interactions without embeddings are skipped.
