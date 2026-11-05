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
| Format (write / check) | `npm --prefix api run format` and `npm --prefix api run format:check` |
| New migration | `npm --prefix api run migrate -- --name <name>` |
| Seed data (also embeds notes; first run downloads the embedding model) | `npm --prefix api run seed` |
| Embed interactions missing an embedding | `npm --prefix api run embed:backfill` |
| Install web deps | `npm --prefix web install` |
| Web dev server (port 3000, needs the API on 3001) | `npm --prefix web run dev` |
| Web tests | `npm --prefix web run test` |
| Web lint and typecheck | `npm --prefix web run lint` and `npm --prefix web run typecheck` |
| Web format (write / check) | `npm --prefix web run format` and `npm --prefix web run format:check` |
| Web production build | `npm --prefix web run build` |

Before reporting a task as done, run `format` in every package you changed, then lint, typecheck and all API tests. If `web/` changed, also run web lint, typecheck, test and build.

Formatting is Prettier with one shared config at the repository root (`.prettierrc.json`, `.prettierignore`). ESLint extends `eslint-config-prettier`, so it never reports formatting; do not add stylistic ESLint rules.

### Full stack in Docker

Local development runs only `db` in Docker. The `api` and `web` services belong to the compose profile `full`, so they start only when the profile is named. Stop local dev servers first: the containers publish the same ports (3000, 3001).

| Task | Command |
|------|---------|
| Build and start db, api and web (waits until all are healthy) | `docker compose --profile full up -d --build --wait` |
| Seed the containerized database | `docker compose --profile full exec api node dist/prisma/seed.js` |
| Stop the stack (keeps the database volume) | `docker compose --profile full down` |

- The `full` profile uses the same `db` container and volume as local development, and seeding deletes all existing companies first.
- The API container applies migrations (`prisma migrate deploy`) on start, then starts the server. The web container reaches it at `http://api:3001`.
- The embedding model is downloaded during the image build into `/app/models`. The container runs with `EMBEDDING_OFFLINE=true`, so it never downloads at runtime.
- `ANTHROPIC_API_KEY` (and `ANTHROPIC_MODEL`) are passed through from the shell or a root `.env` file. Without a key the stack still works with rule-based scoring.

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

## UI rules

- Style: minimalist, Linear-like. Compact, 1px borders, almost no shadows, generous whitespace, 14px base text, Geist font (from the `geist` npm package, no network at build time).
- **Pages are built only from the components in `web/src/components/ui/`** (Button, ButtonLink, TextLink, Card, Badge, Table parts, Input, Select, Textarea, Label, FieldError, ScoreBar, PageHeader, EmptyState) plus layout utilities (flex, grid, gap, spacing, width). If something is missing, add a small component to `components/ui/` instead of styling it inline in a page.
- **Colors come only from the design tokens** in `web/src/app/globals.css`, through their Tailwind names: `bg-background`, `bg-surface`, `bg-surface-hover`, `border-border`, `border-border-strong`, `text-foreground`, `text-muted`, `bg-accent` / `text-accent-foreground`, `text-link`, `success`, `warning`, `danger` (with `-subtle` backgrounds), `bg-danger` / `text-danger-foreground` / `hover:bg-danger-hover` (the danger Button, for confirming destructive actions only), and `bg-overlay` (modal backdrops, `backdrop:bg-overlay`). No raw hex, rgb or Tailwind palette colors (`slate-500`, `red-50`, ...) in components.
- State colors (success, warning, danger) are for states only: WON, LOST, overdue, errors, health. Not for decoration.
- **Every page must work in both themes.** Tokens switch automatically; check new UI in light and dark. Any new token needs a light and a dark value, both meeting WCAG AA (4.5:1 for text).
- Theme: no `data-theme` on `<html>` means "follow the system". The inline script in `app/layout.tsx` applies a stored choice before first paint; `lib/theme.ts` owns the storage key and logic.
- `className` on a ui component is for layout only (margins, width, flex). It is joined with `cn`, which does not resolve conflicting Tailwind classes.

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
