# PilotDeal

AI-assisted mini CRM. Tracks companies, contacts, deals and interactions, ranks deals by priority with a "next best action", and answers natural-language questions about CRM data ("Ask your CRM") using retrieval over interaction notes.

Single user, no authentication yet. All UI text, seed data, code, comments and docs are in English.

## Repository layout

```
api/                  Express REST API (TypeScript, Prisma, PostgreSQL)
  src/
    app.ts            Express app setup (no listen; imported by tests)
    server.ts         Starts the HTTP server
    config/           Environment loading and validation (zod)
    modules/<name>/   One folder per domain: companies, contacts, deals, interactions, ask
      <name>.controller.ts
      <name>.service.ts
      <name>.repository.ts
      <name>.schemas.ts      zod request schemas and inferred types
      <name>.routes.ts
    scoring/          PriorityScorer interface and implementations
    ai/               LLM client and EmbeddingProvider interface and implementations
    shared/           Errors, error middleware, utilities
    scripts/          CLI entry points (embed:backfill)
  prisma/             schema.prisma, migrations, seed.ts
  tests/
    unit/             No database, no network
    integration/      Supertest against a real test database
web/                  Next.js dashboard (App Router), consumes the API over HTTP only
docker-compose.yml    db (pgvector), api, web
.claude/              Feature pipeline (commands and agents). Do not modify unless asked.
```

## Commands

Run from the repository root.

| Task | Command |
|------|---------|
| Start database | `docker compose up -d db` |
| Install API deps | `npm --prefix api install` |
| API dev server | `npm --prefix api run dev` |
| Unit tests | `npm --prefix api run test:unit` |
| Integration tests (needs db running) | `npm --prefix api run test:integration` |
| All API tests | `npm --prefix api test` |
| Lint and typecheck | `npm --prefix api run lint` and `npm --prefix api run typecheck` |
| New migration | `npm --prefix api run migrate -- --name <name>` |
| Seed data (also embeds notes; first run downloads the embedding model) | `npm --prefix api run seed` |
| Embed interactions missing an embedding | `npm --prefix api run embed:backfill` |
| Install web deps | `npm --prefix web install` |
| Web dev server (port 3000, needs the API on 3001) | `npm --prefix web run dev` |
| Web tests | `npm --prefix web run test` |
| Web lint and typecheck | `npm --prefix web run lint` and `npm --prefix web run typecheck` |
| Web production build | `npm --prefix web run build` |

Before reporting a task as done, run lint, typecheck and all API tests. If `web/` changed, also run web lint, typecheck, test and build.

## Architecture rules

- **Layers, one direction only:** routes -> controller -> service -> repository -> Prisma.
  - Controllers handle HTTP only: parse and validate input, call one service method, map the result to a response. No business logic, no Prisma.
  - Services hold business logic. They never touch `req`/`res` and never import Prisma directly.
  - Repositories are the only code that talks to Prisma or runs raw SQL.
- **Classes with constructor injection.** Services and repositories are classes that receive their dependencies through the constructor (for example `new DealService(dealRepository, priorityScorer)`). Wire everything in one place (`src/container.ts`). Never instantiate dependencies inside a class.
- **Program to interfaces (Strategy pattern):**
  - `PriorityScorer` with `RuleBasedScorer` (days since last interaction, deal value, stage, expected close date) and `LlmScorer` (Claude API). Output: `{ score: 0-100, reason: string, nextAction: string }`.
  - `EmbeddingProvider` with `LocalEmbeddingProvider` (transformers.js). Design it so another provider can be added later without changing callers.
  - Choose implementations in `container.ts` from config, never with `if` checks scattered through services.
- **Validation:** every request body, query and route param is validated with zod in the controller. Invalid input returns 400 with a consistent error shape.
- **Errors:** throw typed errors from `shared/errors.ts` (`NotFoundError`, `ValidationError`, ...). A single error middleware maps them to status codes. Response shape: `{ error: { code, message, details? } }`.
- **HTTP conventions:** plural resource nouns (`/companies`, `/deals/:id/interactions`), 201 on create with the created resource, 204 on delete, 404 for missing resources.
- Keep functions small and names explicit. No `any`. TypeScript strict mode stays on.

## Web rules

- Next.js 16 (App Router, Cache Components on). Read the guides in `web/node_modules/next/dist/docs/` before using a Next.js API: this version differs from older ones.
- **Data is fetched only on the server**, in Server Components and Server Actions, through `web/src/lib/api.ts`. No direct `fetch` calls in components, and no API calls from the browser. `api.ts` imports `server-only` and reads the base URL from `API_URL`.
- **Mutations use Server Actions** that call `lib/api.ts`.
- **Types in `web/src/lib/types.ts` mirror the API response shapes.** Update them when an API response changes.
- API failures surface as `ApiError` (`status`, `code`). `status` 0 with code `API_UNREACHABLE` means the API did not answer.
- Wrap components that fetch request-time data in `<Suspense>` with a fallback, so the rest of the page can be prerendered.
- Components stay small. There is no business logic in the web app: the API owns all rules, including scoring. The web app only fetches, displays and submits.
- Tests (`web/tests/unit/`): Vitest and React Testing Library, with a mocked `fetch` or a mocked `lib/api.ts`. They never call a real API.

## AI integration

- **LLM:** Claude via `@anthropic-ai/sdk`. Model name comes from `ANTHROPIC_MODEL` (default `claude-haiku-5-5`). The API key comes from `ANTHROPIC_API_KEY`.
- **The app must work without an API key.** If `ANTHROPIC_API_KEY` is missing, use `RuleBasedScorer`, and `/ask` returns the most relevant interactions without a generated answer. Never crash on a missing key.
- Ask Claude for JSON output and validate it with zod. If parsing fails, fall back to `RuleBasedScorer` and log a warning.
- Keep prompts in `src/ai/prompts.ts`, not inline in services.
- **Embeddings:** `@huggingface/transformers` with `Xenova/all-MiniLM-L6-v2` (384 dimensions), loaded once and reused.
- **Vector storage:** PostgreSQL with pgvector (Docker image `pgvector/pgvector:pg16`). The extension must be enabled by a migration (`CREATE EXTENSION IF NOT EXISTS vector;`) before any vector column is created. Prisma has no native vector type: declare the column as `Unsupported("vector(384)")` and read or write it with `$queryRaw` / `$executeRaw` inside the repository only. Use parameterized raw queries, never string concatenation.
- No vector index: /ask uses exact cosine search, which is always correct with filters and fast at this scale. Consider an HNSW index only with hundreds of thousands of interactions.
- Embed an interaction's notes when it is created or its notes change.

## Testing

- Vitest for everything, Supertest for HTTP integration tests.
- **Unit tests** (`tests/unit/`): services and scorers with mocked repositories and mocked AI. No database, no network.
- **Integration tests** (`tests/integration/`): real endpoints against a separate test database (`DATABASE_URL_TEST`), never the development database. The test setup applies migrations to it (`prisma migrate deploy`) before the run, and data is reset between tests.
- **Tests never call the real Claude API or download embedding models.** Mock `LlmScorer`'s client and `EmbeddingProvider` (a fake that returns deterministic vectors).
- Test names describe behavior: `it("returns 404 when the deal does not exist")`.
- Every new endpoint gets integration tests for the success path, validation errors and not found. Every scorer rule gets unit tests, including edge cases (no interactions, past close date, zero value).
- Prefer table-driven tests (`it.each`) for cases that differ only in input and expected output, instead of one test per variant.
- Each test must be able to fail: it checks one specific behavior, and removing or breaking that behavior makes it fail.
- Do not duplicate coverage: if a validation rule is covered by unit tests, integration tests only need one representative case for it.

## Data model (starting point)

- `Company`: id, name, industry?, website?, createdAt
- `Contact`: id, companyId, name, email?, phone?, role?
- `Deal`: id, companyId, title, value (decimal), stage (`LEAD`, `QUALIFIED`, `PROPOSAL`, `NEGOTIATION`, `WON`, `LOST`), expectedCloseDate?, createdAt, updatedAt
- `Interaction`: id, dealId, type (`EMAIL`, `CALL`, `MEETING`, `NOTE`), notes, occurredAt, embedding vector(384)?

Deleting a company deletes its contacts, deals and interactions (cascade).

## Environment

- Real values live in `.env` (gitignored). Keep `.env.example` up to date whenever a variable is added.
- Validate env vars at startup in `src/config/`. Fail fast with a clear message if a required one is missing. `ANTHROPIC_API_KEY` is optional.

## Git and workflow

- Never run `git commit`, `git push` or any other git command that changes history. The human reviews and commits.
- Commit messages follow Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`, `docs:`). Suggest one at the end of a task.
- Do not add new dependencies without saying why in the task summary.
- In summaries and `.pipeline/implementation.md`, explain non-obvious decisions in plain English (which pattern was used and why), so the code can be explained in a code review or interview.
