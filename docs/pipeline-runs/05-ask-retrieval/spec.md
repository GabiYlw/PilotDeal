# Spec: Semantic search over interaction notes ("Ask your CRM", retrieval only)

## Task
Embed every interaction's notes with a local sentence-embedding model (`Xenova/all-MiniLM-L6-v2`, 384 dimensions) and store the vector in a pgvector column. Add `POST /ask`, which embeds a question and returns the most similar interaction notes (cosine similarity at least 0.25), optionally scoped to one deal. No LLM answer is generated yet: `answer` is always `null` and `answeredBy` is always `"none"`.

## Requirements

### Embedding provider (`api/src/ai/embedding-provider.ts`, new)
1. Exports:
   ```ts
   export const EMBEDDING_DIMENSIONS = 384; // must match the vector(384) column
   export interface EmbeddingProvider {
     /** Length of every vector returned by embed(). */
     readonly dimensions: number;
     /** One vector per input text, in input order. An empty input resolves to []. */
     embed(texts: string[]): Promise<number[][]>;
   }
   export class EmbeddingOutputError extends Error {} // name = "EmbeddingOutputError"; plain Error, never reaches HTTP directly
   export async function embedTexts(provider: EmbeddingProvider, texts: string[]): Promise<number[][]>;
   export async function embedText(provider: EmbeddingProvider, text: string): Promise<number[]>;
   ```
2. `embedTexts` calls `provider.embed(texts)` once and throws `EmbeddingOutputError` unless the result has exactly `texts.length` vectors, each of length `provider.dimensions`, with every element `Number.isFinite`. `embedText(provider, text)` is `embedTexts(provider, [text])` and returns the single vector. Every caller in `src` goes through these two helpers, never `provider.embed` directly, so a misbehaving provider can never write a malformed vector.

### LocalEmbeddingProvider (`api/src/ai/local-embedding-provider.ts`, new)
3. Exports:
   ```ts
   export const LOCAL_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";
   export interface EmbeddingTensor { data: Float32Array; dims: number[] }
   export interface FeatureExtractionOptions { pooling: "mean"; normalize: true }
   export type FeatureExtractor = (texts: string[], options: FeatureExtractionOptions) => Promise<EmbeddingTensor>;
   export type FeatureExtractorLoader = (model: string) => Promise<FeatureExtractor>;
   export class LocalEmbeddingProvider implements EmbeddingProvider
   ```
4. Constructor: `(private readonly loadExtractor: FeatureExtractorLoader, private readonly model: string)`. Construction does no I/O and does not call `loadExtractor`. `dimensions` is `EMBEDDING_DIMENSIONS` (384).
5. `embed(texts)`:
   - `texts.length === 0`: resolve `[]` without loading the model.
   - Otherwise get the extractor (lazy, see 6), call it once with `(texts, { pooling: "mean", normalize: true })`, and convert the tensor into `number[][]`: require `dims` to equal `[texts.length, 384]` and `data.length === texts.length * 384`, otherwise throw `EmbeddingOutputError`. Row `i` is `Array.from(data.subarray(i * 384, (i + 1) * 384))`.
6. Lazy, load-once, concurrency-safe: a private field `extractorPromise: Promise<FeatureExtractor> | null = null`. `getExtractor()` does `this.extractorPromise ??= this.loadExtractor(this.model).catch((error: unknown) => { this.extractorPromise = null; throw error; })` and returns it. The **promise** is cached, not the resolved value, so N concurrent first calls share one load. On load failure the cache is reset, so every caller waiting on that load gets the rejection, and the next call retries (a transient download or network failure does not need a server restart).

### Transformers adapter (`api/src/ai/transformers-extractor.ts`, new)
7. `export async function loadTransformersExtractor(model: string): Promise<FeatureExtractor>`. This is the **only** file in `src` that references `@huggingface/transformers`, and it does so with a dynamic `await import("@huggingface/transformers")`. Importing `container.ts` (server, tests, scripts) therefore never loads onnxruntime, and nothing is downloaded until the first real `embed()` call.
8. It calls `pipeline("feature-extraction", model, { dtype: "fp32" })` once and returns `async (texts, options) => { const output = await extractor(texts, options); return { data: toFloat32(output.data), dims: [...output.dims] }; }`. `toFloat32` returns the array when it is a `Float32Array` and otherwise throws `EmbeddingOutputError`. No `any`, no unchecked casts. Check the exact names and types against the installed `.d.ts` (see Sequencing step 1).

### Storage
9. `schema.prisma`, model `Interaction`: add `embedding Unsupported("vector(384)")?` with a comment above it:
   `// Written and read only with raw SQL in repositories. The HNSW index "Interaction_embedding_hnsw_idx" is created by hand in migration add_interaction_embeddings; Prisma cannot model it.`
10. Migration `prisma/migrations/<timestamp>_add_interaction_embeddings/migration.sql`. It is created with `--create-only` and then edited by hand. Its final content:
    ```sql
    -- AlterTable
    ALTER TABLE "Interaction" ADD COLUMN "embedding" vector(384);

    -- Added by hand: Prisma cannot model HNSW indexes. Cosine distance (<=>) matches the /ask search.
    CREATE INDEX "Interaction_embedding_hnsw_idx" ON "Interaction" USING hnsw ("embedding" vector_cosine_ops);
    ```
    The `enable_pgvector` migration (20261028000000) already runs earlier, so the `vector` type exists, in the shadow database too.
11. Prisma Client never returns `embedding`, because Unsupported fields are not part of the client. The `Interaction` API shape is unchanged and never contains `embedding`.
12. All vector SQL lives in repositories and uses only the tagged-template `$queryRaw` / `$executeRaw`. Never `$queryRawUnsafe` / `$executeRawUnsafe`, never string interpolation. A vector is passed as **one text parameter** produced by `toVectorLiteral` and cast in SQL with `::vector`.
13. `api/src/shared/pgvector.ts` (new): `export function toVectorLiteral(vector: readonly number[]): string` returns `` `[${vector.join(",")}]` `` (for example `[0.1,-0.2,3e-7]`, since pgvector parses exponent notation). It throws `Error("Vector contains a non-finite value")` if any element is not finite. Only repositories (and test DB helpers) import it.
14. Raw SQL never selects the `embedding` column as-is (Prisma cannot deserialize `vector`). Test helpers that need to read it cast it with `"embedding"::text`.

### Interaction repository (`api/src/modules/interactions/interactions.repository.ts`)
15. Add to `InteractionRepository` and implement in `PrismaInteractionRepository`:
    ```ts
    /** Writes the vector only if the row still has exactly these notes. Returns true if a row was updated. */
    saveEmbedding(id: string, notes: string, embedding: number[]): Promise<boolean>;
    /** Sets embedding to NULL only if the row still has exactly these notes. Returns true if a row was updated. */
    clearEmbedding(id: string, notes: string): Promise<boolean>;
    /** Interactions whose embedding is NULL, with id > afterId (null = from the start), ordered by id, at most `limit`. */
    listMissingEmbeddings(afterId: string | null, limit: number): Promise<EmbeddableInteraction[]>;
    ```
    Exact SQL:
    ```ts
    // saveEmbedding
    const count = await this.prisma.$executeRaw`
      UPDATE "Interaction"
      SET "embedding" = ${toVectorLiteral(embedding)}::vector
      WHERE "id" = ${id}::uuid AND "notes" = ${notes}
    `;
    return count > 0;

    // clearEmbedding
    const count = await this.prisma.$executeRaw`
      UPDATE "Interaction"
      SET "embedding" = NULL
      WHERE "id" = ${id}::uuid AND "notes" = ${notes}
    `;
    return count > 0;

    // listMissingEmbeddings
    return this.prisma.$queryRaw<EmbeddableInteraction[]>`
      SELECT "id", "notes"
      FROM "Interaction"
      WHERE "embedding" IS NULL
        AND (${afterId}::uuid IS NULL OR "id" > ${afterId}::uuid)
      ORDER BY "id" ASC
      LIMIT ${limit}
    `;
    ```
    The `"notes" = ${notes}` guard is a compare-and-set. If the notes changed between embedding and writing (a concurrent PATCH, or a PATCH during the backfill), the stale vector or the clear is not applied. Raw updates do not touch `updatedAt` (Prisma's `@updatedAt` is client-side), so storing an embedding never changes the interaction's `updatedAt`.
16. `interactions.schemas.ts`: add `export interface EmbeddableInteraction { id: string; notes: string }`. `Interaction` is unchanged.

### InteractionEmbeddingService (`api/src/modules/interactions/interaction-embeddings.service.ts`, new)
17. Exports:
    ```ts
    export const EMBEDDING_BACKFILL_BATCH_SIZE = 32;
    export interface EmbeddingBackfillResult { updated: number; failed: number }
    export class InteractionEmbeddingService {
      constructor(interactionRepository: InteractionRepository, embeddingProvider: EmbeddingProvider, logger: Logger)
      refreshEmbedding(interaction: EmbeddableInteraction): Promise<void>;
      backfillMissing(batchSize?: number): Promise<EmbeddingBackfillResult>; // default EMBEDDING_BACKFILL_BATCH_SIZE
    }
    ```
18. `refreshEmbedding` **never rejects**:
    1. `try { const vector = await embedText(provider, interaction.notes); await repo.saveEmbedding(interaction.id, interaction.notes, vector); }`
    2. `catch (error)`: `logger.warn("Could not embed interaction notes; the embedding is left empty", { interactionId: interaction.id, error: describeError(error) })`, then `await this.clearQuietly(interaction)`.
    3. `clearQuietly` calls `repo.clearEmbedding(id, notes)`. If that throws, it logs `logger.warn("Could not clear a stale interaction embedding", { interactionId, error: describeError(error) })` and resolves.
    The log context never contains the notes or any vector, only `interactionId` and the error name and message.
19. `backfillMissing(batchSize)`:
    - It throws `RangeError("batchSize must be a positive integer")` if `batchSize` is not a positive integer.
    - Keyset loop: `afterId = null`, then repeatedly `batch = await repo.listMissingEmbeddings(afterId, batchSize)`. Stop when the batch is empty. For each batch, run **one** `embedTexts(provider, batch.map(n => n.notes))` call:
      - Success: for each row, `await repo.saveEmbedding(row.id, row.notes, vectors[i])` and add 1 to `updated` when it returns true. A false return (the notes changed meanwhile) counts as neither updated nor failed.
      - Embedding failure (provider error or `EmbeddingOutputError`): `logger.warn("Could not embed a batch of interactions", { interactionIds: batch.map(r => r.id), error: describeError(error) })`, add `batch.length` to `failed`, and continue with the next batch.
      - Repository (database) errors are **not** caught. They reject `backfillMissing`, because the script should fail loudly on a broken database.
      - Then `afterId = last id of the batch`. Stop when `batch.length < batchSize`.
    - The keyset (`id > afterId`) guarantees termination even when rows keep failing and stay NULL.
    - Return `{ updated, failed }`.
20. Move `describeError` from `api/src/scoring/llm-scorer.ts` to `api/src/shared/describe-error.ts` (`export function describeError(error: unknown): string`, same body). `llm-scorer.ts` imports it from there. Behaviour is unchanged.

### InteractionService (`api/src/modules/interactions/interactions.service.ts`)
21. Constructor: `(interactionRepository, dealRepository, interactionEmbeddings: InteractionEmbeddingService)`.
22. `createForDeal`: unchanged up to a successful `create`, then `await this.interactionEmbeddings.refreshEmbedding(interaction)`, then return the interaction. Order: **(1) the row is saved by Prisma, (2) the notes are embedded, (3) the vector is written by a separate raw UPDATE.** The 404 paths (missing deal, deal deleted before insert) never call the embedding service.
23. `update`: after a successful repository update, call `refreshEmbedding(updated)` **iff `input.notes !== undefined`**, meaning the PATCH body contained `notes`. A PATCH with only `type` and/or `occurredAt` never calls the embedding service, so the stored embedding stays untouched. A 404 never embeds.
24. The response of create and update is the same `Interaction` object as before, with no embedding field. The embedding step is awaited (not fire-and-forget), so when the response arrives the embedding is already stored or cleared. This makes behaviour deterministic for tests and for an immediate `/ask`.
25. Failure policy: an embedding failure never fails the request (201 / 200 as usual). On create the embedding stays NULL. On PATCH with new notes, the old embedding is **cleared to NULL** (see Open question 5 for why).

### Ask module (`api/src/modules/ask/`, new)
26. `ask.schemas.ts`:
    ```ts
    export const ASK_QUESTION_MIN_LENGTH = 3;
    export const ASK_QUESTION_MAX_LENGTH = 500;
    export const ASK_DEFAULT_LIMIT = 5;
    export const ASK_MAX_LIMIT = 10;
    export const askRequestSchema = z.strictObject({
      question: z.string().trim().min(ASK_QUESTION_MIN_LENGTH).max(ASK_QUESTION_MAX_LENGTH),
      dealId: z.uuid().optional(),
      limit: z.number().int().min(1).max(ASK_MAX_LIMIT).default(ASK_DEFAULT_LIMIT),
    });
    export type AskInput = z.output<typeof askRequestSchema>;
    export type AnsweredBy = "none"; // the next task adds "llm"
    export interface AskSource {
      interactionId: string; dealId: string; dealTitle: string; companyName: string;
      type: InteractionType; occurredAt: Date; excerpt: string; similarity: number;
    }
    export interface AskResponse { answer: null; answeredBy: AnsweredBy; sources: AskSource[] }
    export interface InteractionSearchQuery { embedding: number[]; dealId: string | null; maxDistance: number; limit: number }
    export interface InteractionSearchRow {
      interactionId: string; dealId: string; dealTitle: string; companyName: string;
      type: InteractionType; notes: string; occurredAt: Date; similarity: number;
    }
    ```
    The length limits apply after trimming. `limit` must be a JSON integer (no string coercion, like `value` in deals). `dealId: null` is rejected.
27. `ask.repository.ts`: `export interface AskRepository { searchInteractions(query: InteractionSearchQuery): Promise<InteractionSearchRow[]> }` and `PrismaAskRepository` with the exact SQL:
    ```ts
    const vector = toVectorLiteral(query.embedding);
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
    ```
    - The threshold is written as a **distance** (`<= maxDistance`), not as `1 - distance >= minSimilarity`. That is deliberate and NaN-safe. pgvector returns NaN for the cosine distance with a zero-norm vector, and PostgreSQL sorts NaN above every number. So `NaN <= 0.75` is false (row excluded), whereas `1 - NaN >= 0.25` would be **true** (row wrongly included). Keep a one-line comment saying this.
    - `ORDER BY <distance> ASC` (not `similarity DESC`) is the form an HNSW `vector_cosine_ops` index can serve. `i."id"` breaks ties deterministically.
    - `similarity` is float8, which comes back as a JS `number`. `occurredAt` (timestamp(3)) comes back as `Date`. `uuid` and `text` come back as `string`. Verify with the integration tests. If the adapter returns `occurredAt` as a string, map it with `new Date(...)` in a small `toSearchRow` function in the repository.
28. `ask.service.ts`:
    ```ts
    export const MIN_SIMILARITY = 0.25;
    export const EXCERPT_LENGTH = 300;
    export class AskService {
      constructor(askRepository: AskRepository, dealRepository: DealRepository, embeddingProvider: EmbeddingProvider, logger: Logger)
      ask(input: AskInput): Promise<AskResponse>;
    }
    ```
    `ask(input)`:
    1. If `input.dealId` is set and `dealRepository.findById(dealId)` returns null, throw `new NotFoundError(\`Deal ${dealId} not found\`)`. This happens **before** embedding, so a 404 never computes an embedding.
    2. `embedText(provider, input.question)`. On error: `logger.warn("Could not embed the question", { error: describeError(error) })` (never the question text), then throw `new EmbeddingUnavailableError("Semantic search is unavailable: the question could not be embedded")`.
    3. `rows = await askRepository.searchInteractions({ embedding, dealId: input.dealId ?? null, maxDistance: 1 - MIN_SIMILARITY, limit: input.limit })`.
    4. Return `{ answer: null, answeredBy: "none", sources: rows.map(toSource) }`, keeping the repository order.
    - `toSource(row)` copies every field except `notes`, and sets `excerpt = Array.from(row.notes).slice(0, EXCERPT_LENGTH).join("")` (the first 300 Unicode code points, so a surrogate pair is never split, with no ellipsis; notes of 300 chars or fewer come back whole) and `similarity = roundSimilarity(row.similarity)`.
    - `roundSimilarity(x) = Math.round(Math.min(1, Math.max(0, x)) * 1000) / 1000`. The clamp absorbs float noise such as `1.0000001`.
29. `ask.controller.ts`: `AskController` with `ask = async (req, res) => { const input = parseOrThrow(askRequestSchema, req.body, INVALID_BODY_MESSAGE); res.status(200).json(await this.askService.ask(input)); }`. It returns 200, not 201, because nothing is created.
30. `ask.routes.ts`: `export function createAskRouter(controller: AskController): Router` with `router.post("/", controller.ask)`. Mounted in `app.ts` as `app.use("/ask", createAskRouter(controllers.askController))`. Other methods on `/ask` fall through to the existing `notFoundHandler` (404).
31. `shared/errors.ts`: add
    ```ts
    export class EmbeddingUnavailableError extends AppError {
      readonly statusCode = 503;
      readonly code = "EMBEDDING_UNAVAILABLE";
    }
    ```

### Container (`api/src/container.ts`)
32. `ContainerOverrides` gains `embeddingProvider?: EmbeddingProvider`.
33. `export function createEmbeddingProvider(): EmbeddingProvider` returns `new LocalEmbeddingProvider(loadTransformersExtractor, LOCAL_EMBEDDING_MODEL)`. This is the single place to switch providers later (it would take `config` then). No `if` checks elsewhere.
34. `createContainer`:
    - `const embeddingProvider = overrides.embeddingProvider ?? createEmbeddingProvider();`
    - Fail fast: if `embeddingProvider.dimensions !== EMBEDDING_DIMENSIONS`, throw `Error(\`Embedding provider has ${n} dimensions, but the database column is vector(${EMBEDDING_DIMENSIONS})\`)`.
    - Wire `new InteractionEmbeddingService(interactionRepository, embeddingProvider, logger)`, pass it to `InteractionService`, and create `PrismaAskRepository`, `AskService(askRepository, dealRepository, embeddingProvider, logger)` and `AskController`.
    - `Controllers` gains `askController: AskController`. `Container` gains `interactionEmbeddings: InteractionEmbeddingService` (used by the backfill runner and by integration tests).

### Backfill runner and script
35. `api/src/scripts/run-embedding-backfill.ts` (new): `export async function runEmbeddingBackfill(config: Config, overrides: ContainerOverrides = {}): Promise<EmbeddingBackfillResult>`. It does `createContainer(config, overrides)`, then `container.interactionEmbeddings.backfillMissing()`, then `console.log(formatBackfillResult(result))`, and calls `container.disconnect()` in `finally`. `export function formatBackfillResult(r: EmbeddingBackfillResult): string` returns exactly `Embedding backfill: ${r.updated} updated, ${r.failed} failed.`
36. `api/src/scripts/embed-backfill.ts` (new, thin entry point): `import "dotenv/config";` then `runEmbeddingBackfill(loadConfig())`. It sets `process.exitCode = 1` when `result.failed > 0`. `.catch` prints `console.error("Embedding backfill failed:", error)` and sets `process.exitCode = 1`. It has no other logic.
37. `api/package.json` scripts: `"embed:backfill": "tsx src/scripts/embed-backfill.ts"`.

### Seed (`api/prisma/seed.ts`)
38. At the end of `main()`, after the "Seeded ..." line and still inside `try`, call `await runEmbeddingBackfill(config);`. It uses the real `LocalEmbeddingProvider` (no overrides). On the first seed this downloads the model (about 90 MB fp32) into the transformers.js cache. That is acceptable for development, and it never happens in tests. If embedding fails, the seed still completes, and the printed line shows the `failed` count. Warnings come from `ConsoleLogger`.

### Test support (written by the coder, because existing tests need it)
39. `api/tests/support/fake-embedding-provider.ts` (new, shared by unit and integration tests):
    ```ts
    export const FAKE_EMBEDDING_VOCABULARY = ["price", "budget", "timeline", "delay", "contract", "competitor"] as const;
    export const FAKE_OTHER_DIMENSION = FAKE_EMBEDDING_VOCABULARY.length; // 6
    export function fakeEmbedding(text: string): number[];
    export class FakeEmbeddingProvider implements EmbeddingProvider {
      readonly dimensions = 384;
      readonly calls: string[][] = [];      // every embed() input, in order
      failWith(error?: Error): void;        // every later call rejects until reset(); default new Error("Fake embedding failure")
      reset(): void;                        // clears calls and the failure
      embed(texts: string[]): Promise<number[][]>;
    }
    ```
    `fakeEmbedding(text)` is built exactly like this:
    1. `tokens = text.toLowerCase().match(/[a-z]+/g) ?? []`
    2. `v = new Array<number>(384).fill(0)`. For each token equal to `FAKE_EMBEDDING_VOCABULARY[k]`, do `v[k] += 1` (term counts, exact token match: "pricing" and "prices" do **not** match "price").
    3. If no vocabulary word matched, set `v[FAKE_OTHER_DIMENSION] = 1`. The vector is therefore **never zero**, and the NaN case cannot happen in tests.
    4. L2-normalize: divide every element by `Math.sqrt(sum of squares)`.
    `embed` pushes `[...texts]` to `calls`, then returns `Promise.reject(failure)` if a failure is set, else `Promise.resolve(texts.map(fakeEmbedding))`. It is not `async` without an `await`, because of `require-await`.
    Reference cosine similarities for the tester (question "price"):
    | note | similarity |
    |------|-----------|
    | `price` | 1.000 |
    | `price budget` | 0.707 |
    | `price budget timeline` | 0.577 |
    | `price budget budget budget` | 0.316 (above 0.25) |
    | `price budget budget budget budget` | 0.243 (below 0.25) |
    | `budget` or `hello world` | 0 (excluded) |
    Caveat: two texts with no vocabulary words both map to the OTHER dimension and have similarity 1. Tests about "no match" must use a question with vocabulary words and notes with disjoint vocabulary words.
40. `api/tests/integration/test-container.ts` (new): `export function createTestContainer(config: Config, overrides: ContainerOverrides = {}): Container` returns `createContainer(config, { embeddingProvider: new FakeEmbeddingProvider(), ...overrides })`. **Every** integration test file uses it instead of `createContainer`. A test that needs to control the fake passes its own instance through `overrides.embeddingProvider`.
41. `api/tests/integration/database.ts`: add
    - `readEmbedding(prisma, id): Promise<number[] | null>` using `` prisma.$queryRaw<{ embedding: string | null }[]>`SELECT "embedding"::text AS "embedding" FROM "Interaction" WHERE "id" = ${id}::uuid` ``, which returns `JSON.parse` of the text, or null.
    - `writeEmbedding(prisma, id, vector: number[]): Promise<void>` using `` $executeRaw`UPDATE "Interaction" SET "embedding" = ${toVectorLiteral(vector)}::vector WHERE "id" = ${id}::uuid` ``.
    `resetDatabase` keeps its `$executeRawUnsafe` (catalog table names, not user input, already reviewed).
42. `api/tests/integration/http.ts`: add `export interface ApiSource { interactionId: string; dealId: string; dealTitle: string; companyName: string; type: string; occurredAt: string; excerpt: string; similarity: number }`, and add `answer: string | null; answeredBy: string; sources: ApiSource[]` to `ApiBody`.

### Docs
43. `CLAUDE.md` Commands table: add the row `| Embed interactions missing an embedding | \`npm --prefix api run embed:backfill\` |` directly after `Seed data`. Change the Seed row's task text to `Seed data (also embeds notes; first run downloads the embedding model)`. In the layout block, add under `src/`: `scripts/          CLI entry points (embed:backfill)`.
44. `.env.example`: no new variable. The comment on `ANTHROPIC_API_KEY` stays.

## Acceptance criteria
The tester writes the new tests below. The coder writes only the support code (39-42) and the mechanical updates to existing tests (see Sequencing).

### Fake provider (`tests/unit/fake-embedding-provider.test.ts`)
1. `fakeEmbedding` returns 384 numbers with an L2 norm of 1 (to within 1e-9) for a keyword text, a no-keyword text and an empty string. The no-keyword and empty cases have 1 at index 6 and 0 elsewhere.
2. The cosine values for the question "price" match the reference table in requirement 39 (to 3 decimals). Table-driven.

### LocalEmbeddingProvider (`tests/unit/local-embedding-provider.test.ts`; fake loader `vi.fn()` resolving a fake extractor `vi.fn()` that returns `{ data: new Float32Array(n * 384), dims: [n, 384] }` with distinct values per row)
3. `embed(["a", "b"])` calls the extractor once with `(["a", "b"], { pooling: "mean", normalize: true })` and returns 2 arrays of length 384 whose values equal the corresponding slices of `data`.
4. The loader is called with `"Xenova/all-MiniLM-L6-v2"` when the provider is built as in the container (`new LocalEmbeddingProvider(loader, LOCAL_EMBEDDING_MODEL)`).
5. Constructing the provider does not call the loader. `embed([])` resolves to `[]` and does not call the loader.
6. Three concurrent `embed` calls (`Promise.all`) started before the loader resolves (use a deferred promise) call the loader exactly once. Sequential later calls also do not call it again.
7. If the loader rejects once, every concurrent caller of that load rejects, and a later `embed` calls the loader a second time and succeeds.
8. A tensor with the wrong `dims` (for example `[2, 383]`) or the wrong data length makes `embed` reject with `EmbeddingOutputError`. Table-driven.
9. (Recommended) `tests/unit/transformers-extractor.test.ts` with `vi.mock("@huggingface/transformers", ...)`: `loadTransformersExtractor(model)` calls `pipeline("feature-extraction", model, { dtype: "fp32" })` once, the returned function forwards texts and options to the pipeline, and it returns `{ data, dims }`. Nothing is downloaded.

### embedTexts / pgvector helpers (`tests/unit/embedding-provider.test.ts`, `tests/unit/pgvector.test.ts`)
10. `embedTexts` rejects with `EmbeddingOutputError` when the provider returns the wrong vector count, a vector of the wrong length, or a `NaN`/`Infinity` element. It resolves with the vectors otherwise. Table-driven.
11. `toVectorLiteral([0.5, -1, 0])` is `"[0.5,-1,0]"`, and it throws for `NaN` or `Infinity`.

### InteractionEmbeddingService (`tests/unit/interaction-embeddings.service.test.ts`; mocked repository, `FakeEmbeddingProvider` or a mocked provider, logger `{ warn: vi.fn() }`)
12. `refreshEmbedding({ id, notes })` calls `saveEmbedding(id, notes, fakeEmbedding(notes))` and does not warn.
13. When the provider rejects, `refreshEmbedding` resolves, calls `clearEmbedding(id, notes)` and warns once with a context that deep-equals `{ interactionId: id, error: expect.any(String) }`. Neither the message nor the context contains the notes.
14. When the provider returns a malformed vector, this is handled like 13 (no `saveEmbedding`).
15. When the provider rejects **and** `clearEmbedding` rejects, `refreshEmbedding` still resolves and warns twice.
16. Backfill batching: 5 missing rows with `batchSize` 2 lead to `listMissingEmbeddings` calls with `(null, 2)`, `(id2, 2)`, `(id4, 2)`. The provider is called 3 times with the batch notes, and the result is `{ updated: 5, failed: 0 }`.
17. Backfill stops after a short batch: with 3 rows and `batchSize` 2, `listMissingEmbeddings` is called exactly twice.
18. Backfill failure: with 5 rows at `batchSize` 2, if the provider rejects for the 2nd batch only, the 1st and 3rd batches are saved, the result is `{ updated: 3, failed: 2 }`, and it warns once with the `interactionIds` of the failing batch.
19. `saveEmbedding` returning `false` counts as neither updated nor failed.
20. With no missing rows, the result is `{ updated: 0, failed: 0 }` and the provider is never called.
21. `batchSize` 0, -1 or 1.5 rejects with `RangeError`. Table-driven.

### InteractionService (`tests/unit/interactions.service.test.ts`, extended)
22. `createForDeal` calls `refreshEmbedding` once with the created interaction, after `create`, and returns the interaction.
23. `createForDeal` does not call `refreshEmbedding` when the deal is missing or when `create` returns null.
24. `update` with `notes` in the input calls `refreshEmbedding` with the updated interaction. `update` with only `type`, only `occurredAt`, or both, does not call it. Table-driven.
25. `update` returning null (404) does not call `refreshEmbedding`.

### AskService (`tests/unit/ask.service.test.ts`; mocked `AskRepository`, `DealRepository`, a provider, and a logger)
26. It passes `{ embedding: fakeEmbedding(question), dealId: null, maxDistance: 0.75, limit }` to `searchInteractions` (`maxDistance` is `1 - MIN_SIMILARITY` and `MIN_SIMILARITY === 0.25`). With `dealId` it passes that id.
27. With a `dealId` whose deal does not exist, it rejects with `NotFoundError("Deal <id> not found")`, and neither the provider nor `searchInteractions` is called.
28. It maps rows to sources:
    - `notes` is dropped.
    - `excerpt` is the first 300 code points: a 301-char note gives 300 chars, a 300-char note and a short note are unchanged, and an emoji (surrogate pair) straddling position 300 is not split.
    - `similarity` is rounded to 3 decimals, table-driven: 0.70710678 gives 0.707, 0.31622 gives 0.316, 0.2426 gives 0.243, and 1.0000001 is clamped to 1.
    - The order is preserved, `answer` is `null` and `answeredBy` is `"none"`.
29. When the provider rejects, it rejects with `EmbeddingUnavailableError` (503, code `EMBEDDING_UNAVAILABLE`) and warns without the question text.

### Container (`tests/unit/container.test.ts`, extended)
30. `createEmbeddingProvider()` returns a `LocalEmbeddingProvider` with `dimensions === 384`, and building it downloads and loads nothing (no `@huggingface/transformers` import happens. Optionally assert with `vi.mock` that `pipeline` is not called).

### Interactions integration (`tests/integration/interactions-embeddings.test.ts`; `createTestContainer` with a per-file `FakeEmbeddingProvider` and a spy logger; `fake.reset()` in `beforeEach`)
31. `POST /deals/:dealId/interactions` with notes `"Price question"` returns 201, and `readEmbedding(id)` matches `fakeEmbedding("Price question")` element-wise to within float4 precision (`toBeCloseTo(…, 5)`). The response body has no `embedding` key.
32. `PATCH /interactions/:id` with new notes `"Contract delay"` returns 200, and the stored embedding now equals `fakeEmbedding("Contract delay")`.
33. `PATCH` with only `type`, or only `occurredAt`, leaves the stored embedding identical to before and makes no provider call (`fake.calls.length` unchanged). Table-driven.
34. With `fake.failWith()`, POST still returns 201 with the normal body, the embedding is `null`, and the logger's `warn` was called with a context containing `interactionId` equal to the new id. No argument passed to `warn` contains the notes text.
35. With an embedded interaction, `fake.failWith()`, then `PATCH` with new notes: the response is 200, the notes are updated, and the embedding is now `null` (no stale vector).
36. Embedding a note does not change the interaction's `updatedAt`, compared with the response of the POST and a later GET.

### Backfill integration (`tests/integration/embedding-backfill.test.ts`)
37. Create 3 interactions directly with Prisma (embedding NULL). Give a 4th a known vector with `writeEmbedding(id, fakeEmbedding("contract"))` while its notes are `"price"`. Then `container.interactionEmbeddings.backfillMissing()` returns `{ updated: 3, failed: 0 }`, the 3 now have `fakeEmbedding(notes)`, the 4th still has `fakeEmbedding("contract")` (not overwritten), and the fake's calls contain only the 3 notes.
38. A second run returns `{ updated: 0, failed: 0 }`.
39. With `backfillMissing(2)` and 5 missing rows, all 5 are filled (`updated: 5`) and the fake was called 3 times.
40. `formatBackfillResult({ updated: 3, failed: 1 })` is `"Embedding backfill: 3 updated, 1 failed."` (unit test).

### POST /ask integration (`tests/integration/ask.test.ts`; interactions created through POST or with Prisma plus `backfillMissing`)
41. Success shape: 200 with `{ answer: null, answeredBy: "none", sources: [...] }`. Each source has exactly the keys `interactionId, dealId, dealTitle, companyName, type, occurredAt (ISO string), excerpt, similarity`.
42. Ordering: notes `price`, `price budget`, `price budget timeline` and question `"price?"` return those three in that order, with similarities `1`, `0.707`, `0.577`.
43. Threshold: notes `price budget budget budget` (0.316) is returned and `price budget budget budget budget` (0.243) and `budget` (0) are not, for question `"price"`.
44. Limit: with 6 matching notes, no `limit` returns 5, `limit: 2` returns the top 2, and `limit: 10` returns all 6.
45. `dealId` scoping: with matching notes on deals A and B, `dealId: A` returns only A's interactions, with A's `dealTitle` and `companyName`.
46. An unknown but valid UUID `dealId` returns 404 `{ error: { code: "NOT_FOUND", message: "Deal <id> not found" } }`, and the fake records no call.
47. Interactions with a NULL embedding (inserted with Prisma, no backfill) whose notes match the question are not returned.
48. No matching notes (no interactions at all, or only disjoint keywords) returns 200 with `sources: []`.
49. Excerpt: a 400-character note comes back with a 300-character `excerpt` equal to the first 300 characters.
50. Validation, table-driven, all 400 with `error.code === "VALIDATION_ERROR"` and `error.message === "Invalid request body"`, and `details[0].path` naming the field where applicable:
    - missing `question`
    - `question` not a string (`42`)
    - `question` `"  ab  "` (2 chars after trim)
    - `question` of 501 chars
    - `dealId` `"not-a-uuid"`
    - `dealId` `null`
    - `limit` `0`, `11`, `2.5`, `"5"`
    - an unknown field (`foo: 1`)
    - a body that is a JSON array
    Accepted boundaries (200): `question` of exactly 3 chars after trim (`"  abc "`), exactly 500 chars, and `limit` 1 and 10.
51. With `fake.failWith()`, `POST /ask` returns 503 `{ error: { code: "EMBEDDING_UNAVAILABLE", message: "Semantic search is unavailable: the question could not be embedded" } }`.
52. `GET /ask` returns 404 `NOT_FOUND` (route not found).

### Global
53. No test downloads or loads the real model. Every integration file uses `createTestContainer`, so `grep -rn "createContainer(" api/tests/integration` matches only `test-container.ts`. `grep -rn "@huggingface/transformers" api/src` matches only `src/ai/transformers-extractor.ts`.
54. `grep -rnE "\$(queryRawUnsafe|executeRawUnsafe)" api/src` matches nothing. Every `<=>` and `::vector` in `src` occurs only in `*.repository.ts` files (plus the migration SQL).
55. The migration folder `*_add_interaction_embeddings` exists with the SQL from requirement 10, and `prisma migrate deploy` (global setup) applies it to the test database.
56. `npm --prefix api run lint`, `npm --prefix api run typecheck` and `npm --prefix api test` all pass. All pre-existing tests still pass.

## Edge cases
- **Empty input to `embed`:** resolves `[]` and never loads the model. The backfill never calls embed with an empty batch.
- **Concurrent first use:** many requests arriving while the model loads share one loading promise, so there is only one download and one ONNX session.
- **Model load failure** (no network on first use, corrupted cache): every waiting caller fails. Interaction writes still succeed with a NULL embedding, `/ask` returns 503, and the next call retries the load.
- **First request latency:** the first embed after server start loads the model (seconds; the first-ever run also downloads it). That is acceptable for dev. It is usually absorbed by `npm run seed`. A warm-up at startup is out of scope.
- **Zero-norm vectors:** the real model normalizes and never returns a zero vector. The fake has the OTHER dimension. The search SQL is still NaN-safe (distance-form threshold, requirement 27).
- **Negative cosine:** similarity can be in [-1, 0). Those rows have distance > 1 > 0.75, so the threshold excludes them, and the clamp in `roundSimilarity` never needs to lift a negative value.
- **Similarity exactly 0.25:** included (`distance <= 0.75`). Integration tests must not test the exact boundary, because pgvector computes in float4 precision. Use 0.243 and 0.316 instead.
- **Malformed provider output** (wrong count, length, NaN): caught by `embedTexts` and treated like a provider failure everywhere.
- **Concurrent PATCHes of the same interaction:** the compare-and-set `WHERE notes = $notes` makes sure only the vector for the notes actually stored is written. A late failure-clear from an older PATCH also does nothing.
- **PATCH during backfill:** the backfill's stale write matches 0 rows, which is neither updated nor failed. The PATCH's own embedding wins.
- **Interaction deleted between save and embedding write:** the UPDATE matches 0 rows, and that is not an error.
- **PATCH with notes identical to the stored ones:** treated as "notes present", so it re-embeds (harmless). If that re-embed fails, the embedding is cleared, and the next backfill restores it.
- **`dealId` provided, deal deleted between the 404 check and the search:** the search returns `[]`, so the response is 200 with empty sources. That is acceptable.
- **`dealId` for a deal without interactions:** 200 with `sources: []`.
- **Non-ASCII notes:** the excerpt is cut on code points, never inside a surrogate pair.
- **HNSW + WHERE + LIMIT:** see Open question 4. Results may be fewer than `limit` when the index is used. This is acceptable at this scale.
- **Large backfill:** batches of 32 keep memory and ONNX input size bounded. Keyset pagination makes sure it terminates even when batches keep failing.
- **Backfill against a broken database:** it rejects, the script prints `Embedding backfill failed: ...`, and the exit code is 1.
- **Body not JSON / malformed JSON:** the existing middleware already returns 400 `VALIDATION_ERROR`.
- **Prisma reading `vector`:** never select `embedding` without `::text` (Prisma cannot deserialize the type).

## Implementation plan

### Files to touch
- `api/package.json`, `api/package-lock.json`: add `@huggingface/transformers` (dependency) and the `embed:backfill` script.
- `api/prisma/schema.prisma`: `embedding Unsupported("vector(384)")?` plus the comment.
- `api/prisma/migrations/<ts>_add_interaction_embeddings/migration.sql` (new, generated and then edited): column plus HNSW index.
- `api/prisma/seed.ts`: call `runEmbeddingBackfill(config)` at the end.
- `api/src/ai/embedding-provider.ts` (new): interface, `EMBEDDING_DIMENSIONS`, `EmbeddingOutputError`, `embedTexts`, `embedText`.
- `api/src/ai/local-embedding-provider.ts` (new): `LocalEmbeddingProvider` and its narrow extractor types.
- `api/src/ai/transformers-extractor.ts` (new): the only `@huggingface/transformers` user (dynamic import).
- `api/src/shared/pgvector.ts` (new): `toVectorLiteral`.
- `api/src/shared/describe-error.ts` (new): `describeError`, moved from `llm-scorer.ts`.
- `api/src/scoring/llm-scorer.ts`: import `describeError` from shared (no behaviour change).
- `api/src/shared/errors.ts`: `EmbeddingUnavailableError`.
- `api/src/modules/interactions/interactions.schemas.ts`: `EmbeddableInteraction`.
- `api/src/modules/interactions/interactions.repository.ts`: `saveEmbedding`, `clearEmbedding`, `listMissingEmbeddings`.
- `api/src/modules/interactions/interaction-embeddings.service.ts` (new): `InteractionEmbeddingService`.
- `api/src/modules/interactions/interactions.service.ts`: third constructor dependency and the embedding calls.
- `api/src/modules/ask/ask.schemas.ts`, `ask.repository.ts`, `ask.service.ts`, `ask.controller.ts`, `ask.routes.ts` (new).
- `api/src/app.ts`: mount `/ask`.
- `api/src/container.ts`: provider factory, override, dimension check, new wiring, `Container.interactionEmbeddings`, `Controllers.askController`.
- `api/src/scripts/run-embedding-backfill.ts`, `api/src/scripts/embed-backfill.ts` (new).
- `api/tests/support/fake-embedding-provider.ts` (new).
- `api/tests/integration/test-container.ts` (new); `database.ts` and `http.ts` (helpers and types).
- The 10 integration files that call `createContainer(` (companies, contacts-race, deals-interactions-gaps, contacts, deals-race, deals-priority, deals, health, interactions, validation-edge-cases): mechanical switch to `createTestContainer(config, sameOverrides)`.
- `api/tests/integration/deals-race.test.ts`: also pass `container.interactionEmbeddings` as the third `InteractionService` argument in `createInteractionRacingApp`.
- `api/tests/unit/interactions.service.test.ts`: mechanical change. `setup()` builds `interactionEmbeddings = { refreshEmbedding: vi.fn().mockResolvedValue(undefined) }`, passes it cast through `unknown`, and returns it. Also add the three new methods to `createInteractionRepository()`.
- `CLAUDE.md`: Commands table, Seed row and layout line.

### Function-level changes
See Requirements. Summary per file:
- **embedding-provider.ts:** `embedTexts` validates the count, lengths (vs `provider.dimensions`) and finiteness. `embedText` unwraps index 0 (guard `noUncheckedIndexedAccess`).
- **local-embedding-provider.ts:** `embed`, private `getExtractor`, and a module function `toVectors(tensor, count, dimensions)`.
- **transformers-extractor.ts:** `loadTransformersExtractor`, module `toFloat32`.
- **interactions.repository.ts:** three raw methods (exact SQL in requirement 15).
- **interaction-embeddings.service.ts:** `refreshEmbedding`, private `clearQuietly`, `backfillMissing`, private `embedBatch(batch): Promise<EmbeddingBackfillResult>`.
- **interactions.service.ts:** `createForDeal` and `update` call `refreshEmbedding` (requirements 22-23).
- **ask.*:** requirements 26-31. Module functions `toSource` and `roundSimilarity` in `ask.service.ts`, and a `dealNotFound(id)` helper following the pattern in the deals and interactions services.
- **container.ts:** `createEmbeddingProvider`, a private `assertEmbeddingDimensions(provider)`, and the wiring.
- **scripts:** `runEmbeddingBackfill`, `formatBackfillResult`, and the thin entry point.

### Data flow
- **Create:** `POST /deals/:dealId/interactions` goes through the controller (zod), then `InteractionService.createForDeal`: `dealRepository.findById` (404?), then `interactionRepository.create` (Prisma INSERT, embedding NULL), then `InteractionEmbeddingService.refreshEmbedding({ id, notes })`, then `embedText(provider, notes)`, then `[0.01, ...]` (384), then `saveEmbedding`: `UPDATE ... SET embedding = '[...]'::vector WHERE id AND notes`. On failure: warn plus `clearEmbedding`. Finally 201 with the `Interaction`.
- **PATCH:** the same, but the embedding step runs only when the body has `notes`.
- **Ask:** `POST /ask {question, dealId?, limit?}` goes through the controller (`askRequestSchema`), then `AskService.ask`: optional deal check (404), then `embedText(question)` (503 on failure), then `AskRepository.searchInteractions({ embedding, dealId|null, maxDistance: 0.75, limit })` (raw SQL with JOINs on Deal and Company), then rows, then `toSource` (excerpt, rounding), then 200 `{ answer: null, answeredBy: "none", sources }`.
- **Backfill:** `npm run embed:backfill` (or the seed) calls `runEmbeddingBackfill(config)`, then `createContainer`, then `interactionEmbeddings.backfillMissing(32)`: a keyset loop over `listMissingEmbeddings`, then `embedTexts(batch)`, then `saveEmbedding` per row. It prints `Embedding backfill: N updated, M failed.` and disconnects.

### Sequencing
1. **Dependency.** `npm --prefix api install @huggingface/transformers`. Record the installed version. Then open the installed type declarations (`api/node_modules/@huggingface/transformers/types/transformers.d.ts`, `types/pipelines.d.ts`, `types/utils/tensor.d.ts`; find them via its `package.json` `"types"`) and confirm these names: the `pipeline` export and its `("feature-extraction", model, { dtype })` signature, the `dtype` option value `"fp32"`, the `FeatureExtractionPipeline` call options `pooling: "mean"` and `normalize: boolean`, and `Tensor.data` / `Tensor.dims`. If calling `pipeline` with a literal task gives TS2590 ("union type too complex"), annotate the result as `FeatureExtractionPipeline` or narrow with a typed local. Note any difference in `implementation.md`. Do **not** run any code that loads the model during tests.
2. **Schema and migration.** Make sure the DB runs (`docker compose up -d db`). Add the `embedding` field to `schema.prisma`. Run, from the repo root:
   `npm --prefix api run migrate -- --name add_interaction_embeddings --create-only`
   (this runs `prisma migrate dev --name add_interaction_embeddings --create-only`, which writes the migration and does **not** apply it). Open the generated `migration.sql`, check that it contains `ALTER TABLE "Interaction" ADD COLUMN "embedding" vector(384);`, and append the HNSW index statement from requirement 10.
3. **Apply.** `npm --prefix api run migrate` (`prisma migrate dev` with no name). It applies the pending migration to the dev database. It should report the schema is in sync and not ask for a new migration. If it **does** prompt to create a new migration (because it wants to drop the HNSW index), abort with Ctrl+C and apply with `npm --prefix api exec -- prisma migrate deploy` instead, then handle step 4. Then run `npm --prefix api exec -- prisma generate`. Prisma 7's `migrate dev` may no longer run generate automatically; running it is harmless either way.
4. **Drift check (required, document the result).** Run `npm --prefix api run migrate -- --name drift_check --create-only`.
   - If Prisma reports "Already in sync" / creates nothing: there is no drift, so record that in `implementation.md`.
   - If it generates a migration containing `DROP INDEX "Interaction_embedding_hnsw_idx"`: **delete that generated folder**. Record in `implementation.md` that future `migrate dev` runs will try to drop the index. Strengthen the `schema.prisma` comment to: `// Every new migration must be created with --create-only and any DROP INDEX "Interaction_embedding_hnsw_idx" removed before applying.` Also add the same sentence under "New migration" in `CLAUDE.md` Commands (as a note below the table).
   Background: the dev database itself does not drift (the index comes from the migration history, so history and database agree). The risk is the history-vs-schema diff, because `schema.prisma` cannot express an HNSW index.
5. `shared/pgvector.ts`, `shared/describe-error.ts` (and update the `llm-scorer.ts` import), `shared/errors.ts`. Typecheck.
6. `ai/embedding-provider.ts`, `ai/local-embedding-provider.ts`, `ai/transformers-extractor.ts`.
7. `interactions.schemas.ts`, then the repository methods, then `interaction-embeddings.service.ts`, then the `interactions.service.ts` changes.
8. `modules/ask/*`, then `app.ts`.
9. `container.ts`.
10. Test support: `tests/support/fake-embedding-provider.ts`, `tests/integration/test-container.ts`, `database.ts` and `http.ts` helpers. Then the mechanical updates: the 10 integration files to `createTestContainer`, `deals-race.test.ts` third argument, `interactions.service.test.ts` setup. Run typecheck and all tests. Every existing test must pass.
11. Scripts (`src/scripts/*`), the `package.json` script, and the seed change. Manually run `npm --prefix api run seed` once against the **dev** database. This downloads the model and must print `Embedding backfill: 26 updated, 0 failed.` (`prisma/seed.ts` currently defines 26 interactions; recount if different). Then run `npm --prefix api run embed:backfill` and confirm it prints `Embedding backfill: 0 updated, 0 failed.` Optionally smoke-test `POST /ask {"question":"Who is comparing us with a competitor?"}` against the dev server. The Brightlake CFO note ("compare our proposal with a competitor quote") should rank first. Report the observed top results in `implementation.md`.
12. `CLAUDE.md` updates.
13. Run lint, typecheck and all API tests. Write `.pipeline/implementation.md`. It explains: the new dependency (`@huggingface/transformers`, which runs the ONNX MiniLM model locally in Node with no API key or network after the first download, and which pulls in `onnxruntime-node` and `sharp`, so the install is large) and the version; the Strategy pattern for `EmbeddingProvider` and the single switch in `container.ts`; lazy load with a cached promise and reset on failure; the dynamic import; the save-then-embed order and the compare-and-set; why a stale vector is cleared; the NaN-safe distance threshold; the HNSW caveat; the drift-check result; and the fake's construction.

### Conventions to follow
- Layers: routes, then controller, then service, then repository, then Prisma. Only repositories (and test DB helpers) run raw SQL. Services never import Prisma.
- Constructor injection. Only `container.ts` instantiates `LocalEmbeddingProvider`, `InteractionEmbeddingService`, `PrismaAskRepository`, `AskService` and `AskController`. Scripts and the seed obtain them through `createContainer`.
- Use the tagged-template `$queryRaw`/`$executeRaw` with `${param}::vector` / `::uuid` casts. Never use `*Unsafe` in `src`.
- Errors use `shared/errors.ts` with the response shape `{ error: { code, message, details? } }`: 400 `VALIDATION_ERROR` "Invalid request body" with zod `details`, 404 `NOT_FOUND` "Deal <id> not found", and 503 `EMBEDDING_UNAVAILABLE`.
- No `any`, strict mode, `noUncheckedIndexedAccess` (guard indexed access), `.js` import extensions, `import type` for type-only imports (`verbatimModuleSyntax`), and the `require-await` lint rule (use `Promise.resolve`/`reject` in non-awaiting fakes).
- Short "why" comments as in the existing code. Named constants (`MIN_SIMILARITY`, `EXCERPT_LENGTH`, `EMBEDDING_BACKFILL_BATCH_SIZE`, `ASK_*`).
- Tests use Vitest, `it.each` tables, and behaviour-named `it(...)`. They never download the model and never call Claude.
- Never run git commands that change history. Suggested commit: `feat: add semantic search over interaction notes for /ask`.

## Open questions / assumptions
1. **Test wiring.** Integration tests get the fake through a new `ContainerOverrides.embeddingProvider`, applied by the shared `createTestContainer` helper, and all 10 existing integration files switch to it. A config-based switch was rejected, because `src` must not import test code. The fake lives in `tests/support/`, so unit and integration tests share one implementation. `LocalEmbeddingProvider` takes its extractor loader through the constructor (the same idea as injecting `AnthropicMessagesClient` in the previous run), so its unit tests need no module mocking. The real transformers import is dynamic, so importing the container never loads the library.
2. **Fake vector rule.** Term counts over the 6-word vocabulary are L2-normalized, and a dedicated OTHER dimension (index 6) is set when nothing matches, so the vector is never zero. A zero vector was rejected because pgvector's cosine with a zero vector is NaN, and an HNSW cosine index does not index zero vectors. Counts (not booleans) let tests produce graded similarities on both sides of 0.25.
3. **Similarity.** `similarity = 1 - (embedding <=> query)`. The 0.25 threshold is applied in SQL as `distance <= 0.75`. That also removes negative cosines and is NaN-safe. Rounding to 3 decimals and clamping to [0, 1] happen in the service (business presentation), and the threshold constant lives in the service and is passed to the repository.
4. **HNSW with filters.** When Postgres uses the HNSW index, it fetches `hnsw.ef_search` (default 40) nearest candidates and *then* applies `dealId` and the threshold. So it can return fewer than `limit` rows even if more qualify. At this scale (tens to a few thousand interactions) the planner usually picks a sequential scan or the `dealId` btree index, which is exact. Even with the index, losing results needs more than 40 closer rows on other deals. This is accepted for the MVP and documented in `implementation.md`. Future options: `SET LOCAL hnsw.iterative_scan = relaxed_order` (pgvector 0.8+) inside a transaction, or a higher `ef_search`. Tests use tiny tables and must not depend on index usage.
5. **Stale embedding on failed re-embed: clear it to NULL.** A vector for the old notes would surface the interaction for questions about content it no longer contains, while the excerpt shows the new notes, which is a confusing, wrong result. NULL is honest (the row is just not searchable), is visible as missing, and is repaired by `embed:backfill`. A missing result beats a misleading one.
6. **Embedding timing.** The row is saved first (Prisma), then embedded, then the vector is written with a separate raw UPDATE. Prisma cannot write `Unsupported` columns in `create`/`update`. Saving first means the row never depends on the model. The 404 paths skip the embedding cost. The compare-and-set on `notes` closes the race window. The step is awaited for deterministic responses. Fire-and-forget would make tests flaky and could lose errors.
7. **"Notes change" on PATCH** means the validated body contains `notes`, so no extra read is needed. Identical notes re-embed, which is harmless.
8. **Logging.** The warnings contain only ids (`interactionId` / `interactionIds`) and `describeError(error)` (error name and message). They never contain notes, the question or vectors. That is the same policy as `LlmScorer`.
9. **`/ask` embedding failure** returns 503 `EMBEDDING_UNAVAILABLE` (new `AppError`). The task does not define it, and a 500 would hide that this is a known, retryable dependency failure. The interaction endpoints never surface embedding failures.
10. **Backfill placement.** The logic is in `InteractionEmbeddingService.backfillMissing` (unit-testable, reused by script and seed). `runEmbeddingBackfill` only wires, prints and disconnects. The entry script only loads config and sets the exit code. The batch size is 32. Output is one line, `Embedding backfill: N updated, M failed.`, and the exit code is 1 when `failed > 0` or on a crash. The scripts live in `api/src/scripts/` (covered by tsconfig and lint).
11. **Model dtype `fp32`** (about 90 MB, the reference quality of MiniLM) is set explicitly, which also silences transformers.js's "dtype not specified" warning. The cache is the transformers.js default (inside `node_modules/@huggingface/transformers/.cache`), so a clean reinstall re-downloads. No env var is added (YAGNI).
12. **Dimension check at startup.** `createContainer` throws if the provider's `dimensions` is not 384, so a future provider with another size fails fast instead of erroring on every write.
13. **Validation coverage.** The task asks for table-driven validation in the `/ask` integration tests, so validation cases live there and there is no separate `ask.schemas` unit test (no duplicate coverage).
14. **Drift.** I could not run Prisma here. Whether `migrate dev` will try to drop the HNSW index is checked empirically in Sequencing step 4, with a defined fallback (strip the `DROP INDEX` from future `--create-only` migrations and document it in `schema.prisma` and `CLAUDE.md`).
15. **Test ownership.** As in earlier runs, the coder writes the support code (fake, `createTestContainer`, DB helpers, http types) and the mechanical updates. The tester writes the new test files from the acceptance criteria.
