# Test report: semantic search over interaction notes (POST /ask)

## Summary
- Framework: Vitest 5.0.5 (+ Supertest for HTTP). Real test database `dealpilot_test`, fake embedding provider only. The real model was never loaded or downloaded, and neither the seed nor `embed:backfill` was run.
- Commands run from `api/`: `npm run lint`, `npm run typecheck`, `npm test`.
- Results (final run): lint clean, typecheck clean, **39 test files, 825 tests, all passing** (unit project: 25 files, 394 tests; integration project: 14 files, 431 tests).
- Before this stage there were 26 files and 674 tests (per implementation.md), so 13 files and 151 tests were added.
- During development one of my own tests failed (a test-setup mistake: the second `addNotes` call also backfilled the row meant to stay NULL). I fixed the test, not the source. Two lint errors in my own test files were fixed as well. No application bugs found.
- All new files use LF line endings (0 CR characters, checked with grep).

## Tests added
Unit (`api/tests/unit/`):
- `fake-embedding-provider.test.ts`: norm 1 and 384 length (keyword, no keyword, empty); index 6 only for no-keyword and empty; cosine reference table for question "price" (8 rows, includes `pricing prices` not matching); `FakeEmbeddingProvider` calls/failWith/reset.
- `local-embedding-provider.test.ts`: dimensions 384; one extractor call with `{ pooling: "mean", normalize: true }` and row slices equal to the tensor data; loader gets `Xenova/all-MiniLM-L6-v2`; construction does not load; `embed([])` returns `[]` without loading; 3 concurrent calls (deferred loader) load once, later calls do not reload; failed load rejects all concurrent callers and the next call retries; 6 malformed tensors (it.each) reject with `EmbeddingOutputError`.
- `transformers-extractor.test.ts` (module mocked): `pipeline("feature-extraction", model, { dtype: "fp32" })` called once, texts and options forwarded, `{ data, dims }` returned; non-Float32 data rejects with `EmbeddingOutputError`.
- `embedding-provider.test.ts`: well-formed result and single `embed` call; empty input; 6 malformed outputs (count low/high, length short/long, NaN, Infinity); provider rejection propagates; `embedText` single vector, no-vector error, error name.
- `pgvector.test.ts`: literal formatting (3 rows) and non-finite throws (3 rows).
- `interaction-embeddings.service.test.ts`: `refreshEmbedding` success, provider failure (clear + one warn with exact context `{ interactionId, error }`, notes never logged), 3 malformed-output cases, provider and clear both failing (two warns), failing save; `backfillMissing` batching (keyset calls `(null,2) (id2,2) (id4,2)`, 3 provider calls, `{5,0}`), short-batch stop, full last batch then empty, default size 32, failing middle batch (`{3,2}`, one warn with `interactionIds`, no notes), malformed batch output, termination when all batches fail, `saveEmbedding` false counts as neither, empty case, DB errors propagate (list and save), RangeError for 0, -1, 1.5, NaN; `formatBackfillResult`.
- `interactions.service.embeddings.test.ts`: create embeds once after insert and returns the interaction; no embed when the deal is missing or the insert returns null; update embeds for 3 notes-containing inputs, never for type-only, occurredAt-only, both; no embed on 404.
- `ask.service.test.ts`: `MIN_SIMILARITY` is 0.25; search arguments (embedding, `dealId: null`, `maxDistance: 0.75`, limit); deal id passed through; 404 before embedding and search; response mapping (answer null, answeredBy none, order, notes dropped); empty sources; excerpt table (short, 300, 301, 1000 chars, emoji straddling 300, emoji after 300); similarity rounding table (0.70710678, 0.31622, 0.2426, 1.0000001, tiny negative); 503 `EmbeddingUnavailableError` for provider rejection and malformed vector, warn without the question text.
- `embedding-container.test.ts` (module mocked): `createEmbeddingProvider()` is a `LocalEmbeddingProvider`, 384 dims, `pipeline` never called; `createContainer` throws on a provider with 128 dimensions.
- `embed-backfill-script.test.ts`: exit code undefined for `{3,0}` and `{0,0}`, 1 for `{3,1}`; crash prints `Embedding backfill failed:` and sets exit code 1 (module imported fresh with mocked runner and config; `process.exitCode` is reset after each test).

Integration (`api/tests/integration/`, `createTestContainer` with a per-file `FakeEmbeddingProvider` and spy logger):
- `interactions-embeddings.test.ts`: embedding stored on create (no `embedding` key in the body); recomputed on notes change; type-only and occurredAt-only PATCH keep the embedding and make no provider call (it.each); provider failure on create gives 201, null embedding, warn with `interactionId`, notes not logged; provider failure on PATCH gives 200, new notes, embedding cleared; `updatedAt` unchanged by embedding; PATCH of a missing interaction makes no provider call.
- `embedding-backfill.test.ts`: only missing rows are filled (`{3,0}`), the 4th row with a pre-written vector is not overwritten, fake saw only the 3 notes; second run `{0,0}` with no provider call; batch size 2 with 5 rows gives `{5,0}` and 3 provider calls; provider failure gives `{0,3}` and rows stay NULL; `runEmbeddingBackfill` prints `Embedding backfill: 2 updated, 0 failed.` and `... 0 updated, 1 failed.`.
- `ask.test.ts`: success shape and exact source keys and values; order and similarities `[1, 0.707, 0.577]`; threshold (0.316 returned, 0.243 and 0 excluded); limit table (default 5, 2, 10 with 6 notes); limit cuts to the top 2; dealId scoping with deal title and company name; deal without interactions; 404 (body exact, fake called zero times); NULL embeddings skipped; empty sources (no interactions, disjoint keywords); 300-char excerpt of a 400-char note; 503; `GET /ask` 404; 12 validation cases (400, `VALIDATION_ERROR`, "Invalid request body", `details[0].path` equals the field, provider never called); 4 accepted boundaries (3 chars after trim, 500 chars, limit 1, limit 10).

## Failures
None in the final run.

Final output of `npm test`: `Test Files 39 passed (39)`, `Tests 825 passed (825)`.

## Spec-coverage map
| # | Criterion | Status | Tests |
|---|-----------|--------|-------|
| 1 | fakeEmbedding 384 numbers, norm 1, index 6 for no-keyword/empty | Covered & passing | `fake-embedding-provider.test.ts`: "returns 384 numbers with an L2 norm of 1 for ..." (3), "puts all weight on the other dimension for ..." (2) |
| 2 | Cosine table for "price" | Covered & passing | `fake-embedding-provider.test.ts`: "has cosine similarity to the question price for note ..." (8) |
| 3 | Extractor called once with mean/normalize, 384-length rows equal to data slices | Covered & passing | `local-embedding-provider.test.ts`: "calls the extractor once with mean pooling and normalization and returns one 384-length vector per text" |
| 4 | Loader gets the model name | Covered & passing | `local-embedding-provider.test.ts`: "loads the configured model name" |
| 5 | No load on construct / on `embed([])` | Covered & passing | "does not load the model when constructed", "resolves an empty input to [] without loading the model" |
| 6 | Concurrent calls load once | Covered & passing | "loads the model once for concurrent first calls and for later calls" |
| 7 | Load failure rejects all, then retries | Covered & passing | "rejects every concurrent caller when the load fails, then retries the load on the next call" |
| 8 | Wrong dims or data length rejects `EmbeddingOutputError` | Covered & passing | "rejects with EmbeddingOutputError for a tensor with %s" (6 rows) |
| 9 | transformers-extractor with mocked module | Covered & passing | `transformers-extractor.test.ts` (2 tests) |
| 10 | `embedTexts` malformed output | Covered & passing | `embedding-provider.test.ts`: "rejects with EmbeddingOutputError for %s" (6 rows) plus the success test |
| 11 | `toVectorLiteral` | Covered & passing | `pgvector.test.ts` (formatting 3 rows, non-finite 3 rows) |
| 12 | refresh saves `fakeEmbedding(notes)`, no warn | Covered & passing | `interaction-embeddings.service.test.ts`: "saves the embedding of the notes and does not warn" |
| 13 | Provider rejects: resolves, clears, one warn, no notes | Covered & passing | "resolves, clears the embedding and warns without the notes when the provider rejects" (context uses `expect.stringContaining` for `error`, not `expect.any(String)`; it still pins the exact keys) |
| 14 | Malformed vector handled like 13 | Covered & passing | "handles a malformed provider output (%s) like a provider failure" (3 rows) |
| 15 | Provider and clear both reject: two warns | Covered & passing | "still resolves and warns twice when the provider and the clear both fail" |
| 16 | Backfill batching | Covered & passing | "walks the keyset in batches and embeds each batch with one provider call" |
| 17 | Stops after short batch | Covered & passing | "stops after a short batch" |
| 18 | Failing 2nd batch | Covered & passing | "counts a failing batch as failed, warns with its ids and still saves the other batches" |
| 19 | save false is neither | Covered & passing | "counts a save that matches no row as neither updated nor failed" |
| 20 | No missing rows | Covered & passing | "returns zeros and never calls the provider when nothing is missing" |
| 21 | Invalid batchSize RangeError | Covered & passing | "rejects a batch size of %s with RangeError" (0, -1, 1.5, NaN) |
| 22 | create embeds once after create | Covered & passing | `interactions.service.embeddings.test.ts`: "embeds the created interaction once, after the insert, and returns it" |
| 23 | create without embed on 404 paths | Covered & passing | "does not embed when the deal does not exist", "... deleted before the insert" |
| 24 | update embeds only with notes | Covered & passing | "embeds the updated interaction when the input contains %s" (3), "does not embed when the input contains %s" (3) |
| 25 | update 404 does not embed | Covered & passing | "does not embed when the interaction does not exist" |
| 26 | AskService search args | Covered & passing | `ask.service.test.ts`: "searches with the question embedding, ...", "passes the deal id ...", "uses a minimum similarity of 0.25" |
| 27 | Missing deal: NotFoundError, no provider, no search | Covered & passing | "rejects with NotFoundError before embedding or searching when the deal does not exist" |
| 28 | Source mapping, excerpt, rounding | Covered & passing | "returns answer null, answeredBy none, ...", "is the first 300 code points for %s" (6), "rounds the similarity %f to %f" (5) |
| 29 | Provider rejects: `EmbeddingUnavailableError`, warn without question | Covered & passing | "rejects with EmbeddingUnavailableError and warns without the question when %s" (2) |
| 30 | createEmbeddingProvider is lazy | Covered & passing | `embedding-container.test.ts`: "returns a local provider with 384 dimensions and loads no model when built" (placed in a new file, not in `container.test.ts`) |
| 31 | Create stores embedding, no `embedding` key | Covered & passing | `interactions-embeddings.test.ts`: "stores the embedding of the notes when an interaction is created" |
| 32 | PATCH notes recomputes | Covered & passing | "recomputes the embedding when the notes change" |
| 33 | PATCH type/occurredAt keeps it, no provider call | Covered & passing | "keeps the embedding and calls no provider when only %s changes" (2) |
| 34 | Provider failure on create | Covered & passing | "creates the interaction with a null embedding and logs a warning without the notes when the provider fails" |
| 35 | Provider failure on PATCH clears | Covered & passing | "clears the stale embedding and still updates the notes when the provider fails on PATCH" |
| 36 | `updatedAt` unchanged | Covered & passing | "does not change updatedAt when the embedding is stored" (compares POST response with a later GET) |
| 37 | Backfill fills only missing | Covered & passing | `embedding-backfill.test.ts`: "fills only the missing embeddings and reports the count" |
| 38 | Second run is a no-op | Covered & passing | "finds nothing to do on a second run" |
| 39 | `backfillMissing(2)` with 5 rows | Covered & passing | "fills 5 missing rows in 3 provider calls with a batch size of 2" |
| 40 | `formatBackfillResult` | Covered & passing | `interaction-embeddings.service.test.ts`: "formats the one-line summary" (unit); also the `runEmbeddingBackfill` integration tests |
| 41 | Success shape and keys | Covered & passing | `ask.test.ts`: "returns 200 with answer null, answeredBy none and sources with the documented keys" |
| 42 | Ordering and similarities | Covered & passing | "orders the sources by similarity descending ..." |
| 43 | Threshold | Covered & passing | "returns similarity 0.316 and excludes 0.243 and 0 with the 0.25 threshold" |
| 44 | Limit | Covered & passing | "returns the right number of sources for %s" (3), "returns the top interactions when the limit cuts the list" |
| 45 | dealId scoping | Covered & passing | "only returns interactions of the given deal, ..." |
| 46 | 404 for unknown deal, fake not called | Covered & passing | "returns 404 without embedding when the deal does not exist" |
| 47 | NULL embeddings skipped | Covered & passing | "skips interactions without an embedding" |
| 48 | Empty sources | Covered & passing | "returns 200 with an empty sources array when %s" (2) |
| 49 | 300-char excerpt | Covered & passing | "cuts a 400-character note to a 300-character excerpt" |
| 50 | Validation table and boundaries | Covered & passing | "returns 400 VALIDATION_ERROR for %s" (12), "accepts %s" (4) |
| 51 | 503 | Covered & passing | "returns 503 EMBEDDING_UNAVAILABLE when the question cannot be embedded" |
| 52 | GET /ask 404 | Covered & passing | "returns 404 for GET /ask" |
| 53 | No real model, `createContainer(` only in test-container | Covered & passing (checked by grep, no test) | `grep "createContainer(" api/tests/integration` matches only `test-container.ts`; `@huggingface/transformers` in `api/src` only in `ai/transformers-extractor.ts` |
| 54 | No `*Unsafe` in src; `<=>`/`::vector` only in repositories | Partly checked | `grep -rnE "queryRawUnsafe\|executeRawUnsafe" api/src` returned nothing. I did not grep `<=>` / `::vector` placement. No automated test. |
| 55 | Migration applied by global setup | Covered & passing (implicit) | The integration run applies the migrations to the test DB and the embedding tests write and read the `vector` column, which exercises the column. The HNSW index is not asserted. |
| 56 | lint, typecheck, `npm test` pass | Covered & passing | See Summary |

Also covered (not numbered criteria): `createContainer` dimension check, `runEmbeddingBackfill` output, entry-script exit codes (spec requirements 34-36).

Not covered: the real `loadTransformersExtractor` against the real library (needs the model download), the seed's backfill call, and the real `embed:backfill` command run (all deliberately not run). The HNSW-with-filters limitation is not tested because it depends on index use.

## Regressions
None. All 674 previously existing tests still pass (825 total now).
