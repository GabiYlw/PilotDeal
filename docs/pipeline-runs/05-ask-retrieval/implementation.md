# Implementation: semantic search over interaction notes (POST /ask, retrieval only)

## Summary
Interaction notes are now embedded with a local MiniLM model (384 dimensions) and stored in a nullable pgvector column with an HNSW cosine index. An embedding is computed on create and on PATCH when `notes` is in the body. A failed embedding never fails the request: the interaction is saved, a warning is logged, and the embedding stays NULL (or is cleared on PATCH). `npm --prefix api run embed:backfill` fills missing embeddings in batches of 32, and the seed runs it at the end. `POST /ask` embeds the question and returns the nearest interactions (cosine similarity at least 0.25), optionally scoped to one deal. `answer` is always `null` and `answeredBy` is always `"none"`.

Lint, typecheck and all API tests pass (26 files, 674 tests). The seed, the backfill and the real model are unverified (see Notes).

## Files changed
Created:
- `api/src/ai/embedding-provider.ts`: `EmbeddingProvider` interface, `EMBEDDING_DIMENSIONS`, `EmbeddingOutputError`, `embedTexts` and `embedText` (validate count, length, finiteness).
- `api/src/ai/local-embedding-provider.ts`: `LocalEmbeddingProvider` (lazy, cached-promise model load) and the narrow extractor types.
- `api/src/ai/transformers-extractor.ts`: the only file using `@huggingface/transformers` (dynamic import).
- `api/src/shared/pgvector.ts`: `toVectorLiteral`.
- `api/src/shared/describe-error.ts`: `describeError`, moved out of `llm-scorer.ts`.
- `api/src/modules/interactions/interaction-embeddings.service.ts`: `InteractionEmbeddingService` (`refreshEmbedding`, `backfillMissing`).
- `api/src/modules/ask/ask.schemas.ts`, `ask.repository.ts`, `ask.service.ts`, `ask.controller.ts`, `ask.routes.ts`: the `/ask` module.
- `api/src/scripts/run-embedding-backfill.ts`, `api/src/scripts/embed-backfill.ts`: backfill runner and CLI entry point.
- `api/prisma/migrations/20261029124549_add_interaction_embeddings/migration.sql`: column plus HNSW index.
- `api/tests/support/fake-embedding-provider.ts`: `FakeEmbeddingProvider` and `fakeEmbedding`.
- `api/tests/integration/test-container.ts`: `createTestContainer`.

Modified:
- `api/package.json`, `api/package-lock.json`: `@huggingface/transformers` ^4.3.2 and the `embed:backfill` script.
- `api/prisma/schema.prisma`: `embedding Unsupported("vector(384)")?` with comments (including the drift warning).
- `api/prisma/seed.ts`: calls `runEmbeddingBackfill(config)` after the "Seeded ..." line.
- `api/src/shared/errors.ts`: `EmbeddingUnavailableError` (503, `EMBEDDING_UNAVAILABLE`).
- `api/src/scoring/llm-scorer.ts`: imports `describeError` from shared (no behaviour change).
- `api/src/modules/interactions/interactions.schemas.ts`: `EmbeddableInteraction`.
- `api/src/modules/interactions/interactions.repository.ts`: `saveEmbedding`, `clearEmbedding`, `listMissingEmbeddings`.
- `api/src/modules/interactions/interactions.service.ts`: third constructor dependency; embeds after create and after a PATCH that contains notes.
- `api/src/app.ts`: mounts `/ask`.
- `api/src/container.ts`: `createEmbeddingProvider`, `embeddingProvider` override, dimension check, new wiring, `Container.interactionEmbeddings`, `Controllers.askController`.
- `CLAUDE.md`: Commands row for `embed:backfill`, Seed row text, `scripts/` layout line, and a migration note about the HNSW drift.
- `api/tests/integration/database.ts`: `readEmbedding`, `writeEmbedding`.
- `api/tests/integration/http.ts`: `ApiSource` and the new `ApiBody` fields.
- 10 integration files (companies, contacts-race, deals-interactions-gaps, contacts, deals-race, deals-priority, deals, health, interactions, validation-edge-cases): `createContainer` replaced by `createTestContainer`. `deals-race.test.ts` also passes `container.interactionEmbeddings` as the third `InteractionService` argument.
- `api/tests/unit/interactions.service.test.ts`: mock repository has the three new methods; `setup()` builds and returns a mocked `interactionEmbeddings`.

## Deviations from spec
- Key order of a `sources` item in the JSON differs from the interface order (the SQL column order wins for `similarity` vs `excerpt`: `similarity` comes from the row spread, `excerpt` is added after). Same keys and values, so no consumer is affected.
- `EmbeddingOutputError` has an explicit constructor that sets `name` (spec said `name = "EmbeddingOutputError"`, which needs this to be exact).
- Otherwise none. Library types matched the spec with no TS2590 issue, so no `FeatureExtractionPipeline` annotation was needed.

## Notes for tester/reviewer

### New dependency: `@huggingface/transformers` ^4.3.2 (installed 4.3.2)
Why: CLAUDE.md requires local embeddings with `Xenova/all-MiniLM-L6-v2` through `@huggingface/transformers`. It runs the ONNX model inside Node (no API key, no network after the first download), so embeddings stay free and private. It pulls in `onnxruntime-node` and `sharp`, so the install is large (36 packages added). The model (about 90 MB, fp32) is downloaded on first real use into the library cache inside `node_modules`, so a clean reinstall downloads it again. Checked against the installed `.d.ts`: `pipeline("feature-extraction", model, { dtype: "fp32" })`, call options `pooling: "mean"` and `normalize: boolean`, and `Tensor.data` / `Tensor.dims` all exist as the spec assumed.

### Design decisions in plain English
- **Strategy pattern.** Callers depend on the `EmbeddingProvider` interface. `container.ts` (`createEmbeddingProvider`) is the only place that picks the implementation, so adding another provider later changes one function. `createContainer` also fails fast if the provider's `dimensions` is not 384, because the DB column is `vector(384)`.
- **Lazy, load-once, concurrency-safe model.** `LocalEmbeddingProvider` caches the loading *promise*, not the loaded model, so many concurrent first calls share one load. If the load fails, the cache is reset, so the next call retries without a server restart.
- **Dynamic import.** Only `transformers-extractor.ts` imports the library, and only via `await import(...)`. Importing the container (server, scripts, tests) never loads onnxruntime and never downloads anything. The extractor loader is injected into `LocalEmbeddingProvider`, so its unit tests need no module mocking.
- **Validation helpers.** All code calls `embedTexts`/`embedText`, never `provider.embed` directly, so a provider returning the wrong count, size or NaN can never write a bad vector.
- **Save first, embed second, then write the vector.** Prisma cannot write `Unsupported` columns, so the interaction row is created by Prisma and the vector is written afterwards with a raw `UPDATE`. The row therefore never depends on the model. The embedding step is awaited, so the response already reflects the stored or cleared vector, which keeps tests and an immediate `/ask` deterministic.
- **Compare-and-set.** `saveEmbedding` and `clearEmbedding` only update the row if `"notes"` still equals the text that was embedded. If a second PATCH changed the notes in the meantime (or a PATCH happens during a backfill), the stale write matches 0 rows and does nothing. Raw updates do not touch `updatedAt`.
- **Stale vector is cleared on a failed re-embed.** A vector for old notes would surface the interaction for questions about content it no longer has, while showing the new text. NULL is honest (not searchable) and is repaired by `embed:backfill`.
- **NaN-safe threshold.** The SQL filters on distance (`<=> ... <= 0.75`) instead of `1 - distance >= 0.25`. pgvector returns NaN for a zero-norm vector and Postgres sorts NaN above every number, so `NaN <= 0.75` is false (excluded), while `1 - NaN >= 0.25` would wrongly be true. `ORDER BY` uses the raw distance because that is the form the HNSW index can serve.
- **Parameterized SQL only.** Tagged-template `$queryRaw`/`$executeRaw`, vector passed as one text parameter with `::vector`. No `*Unsafe` in `src`. Raw SQL never selects `embedding` as-is (Prisma cannot deserialize `vector`); test helpers cast it to text.
- **Logging.** Warnings contain only ids and `describeError(error)`, never notes, the question or vectors.
- **`/ask` failures.** If the question cannot be embedded, `/ask` returns 503 `EMBEDDING_UNAVAILABLE` (a known, retryable dependency failure) instead of a generic 500. Interaction endpoints never surface embedding failures.
- **Backfill.** Keyset pagination (`id > lastId`) guarantees it ends even if some rows keep failing and stay NULL. Embedding errors count as `failed` for the batch. Database errors are not caught, so the script fails loudly. The script exits with code 1 if `failed > 0`.

### HNSW with filters: limitation
When Postgres uses the HNSW index, it fetches `hnsw.ef_search` (default 40) nearest candidates first and applies the `dealId` filter and the distance threshold afterwards. So with the index in use, `/ask` can return fewer than `limit` rows even if more qualify (it needs more than 40 closer rows from other deals to lose results). At this scale the planner normally uses a sequential scan or the `dealId` index, which is exact. Accepted for the MVP. Future options: `SET LOCAL hnsw.iterative_scan = relaxed_order` (pgvector 0.8+) or a higher `ef_search`.

### Migration and Prisma drift check
- Created with `npm --prefix api run migrate -- --name add_interaction_embeddings --create-only`, then the HNSW `CREATE INDEX` was added by hand, exactly as in the spec.
- Applied to the dev DB with `prisma migrate dev` (confirmed with `prisma migrate status`: "Database schema is up to date", 4 migrations). The test DB gets it through the existing global setup (`migrate deploy`); the test run showed it applying `20261029124549_add_interaction_embeddings`. `prisma generate` was run.
- **Drift result: drift exists.** A further `prisma migrate dev --name drift_check --create-only` generated a migration containing `DROP INDEX "Interaction_embedding_hnsw_idx";` because `schema.prisma` cannot express the HNSW index. That throwaway migration folder was deleted. Following the spec's fallback, the `schema.prisma` comment now says every new migration must be created with `--create-only` and any `DROP INDEX "Interaction_embedding_hnsw_idx"` removed before applying, and the same sentence was added to `CLAUDE.md` below the Commands table.
- Operational note: the first `migrate dev` (no name) hung after applying (it held the advisory lock and a following command timed out on `pg_advisory_lock`). I ended that stuck Postgres connection with `pg_terminate_backend` and re-ran. No data was affected. If `migrate dev` seems stuck for you, `prisma migrate status` shows the real state.

### Unverified (the real model was not downloaded)
- `npm --prefix api run seed` and `npm --prefix api run embed:backfill` were NOT run, because they would download the model. Expected outputs for you to check: seed prints `Embedding backfill: 26 updated, 0 failed.` (recount if the seed has a different number of interactions), a second `embed:backfill` prints `Embedding backfill: 0 updated, 0 failed.` The smoke test `POST /ask {"question":"Who is comparing us with a competitor?"}` should rank the Brightlake CFO note first.
- `loadTransformersExtractor` was only type-checked, never executed.
- I did smoke-test the `/ask` SQL against the test database with the fake provider (then reset the test db): status 200, `similarity` comes back as a JS number, `occurredAt` as a `Date` (verified after the run by an integration test on `PrismaAskRepository`; the ISO string seen earlier was the JSON response), so no `toSearchRow` mapping was needed, notes `price` (1) and `price budget` (0.707) returned and `price budget budget budget budget` (0.243) excluded. The scratch script was deleted.

### Other
- Tests for the new behavior are not written (tester's job). The existing tests all pass with the mechanical updates.
- All created and changed files use LF line endings (checked: no CR characters).
- Suggested commit: `feat: add semantic search over interaction notes for /ask`
