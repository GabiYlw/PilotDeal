### Summary
Added the `Company` and `Contact` Prisma models, one migration, and the `companies` and `contacts` modules (routes -> controller -> service -> repository -> Prisma, wired in `container.ts`). Endpoints: CRUD for companies, nested list/create for contacts under a company, and get/patch/delete for contacts. Includes zod validation, pagination, typed errors, cascade delete, seed data, and unit and integration tests.

### Files changed
- `api/prisma/schema.prisma`: added `Company` and `Contact` models.
- `api/prisma/migrations/20261028120000_add_companies_and_contacts/migration.sql`: hand-written SQL from the spec. `prisma migrate dev` reported "in sync" afterwards, so it matches the schema exactly.
- `api/src/shared/validation.ts` (new): `parseOrThrow`, `toIssueDetails`, message constants, `idParamsSchema`, `optionalText`, `nameSchema`.
- `api/src/shared/pagination.ts` (new): pagination query schema, `Pagination`/`Paginated`/`PageResult` types, `toSkipTake`, `toPaginated`.
- `api/src/shared/prisma-errors.ts` (new): P2025 and P2003 classifiers.
- `api/src/modules/companies/*` (new): schemas, repository, service, controller, routes.
- `api/src/modules/contacts/*` (new): schemas, repository, service, controller, routes (two routers).
- `api/src/container.ts`, `api/src/app.ts`: wiring and router mounting.
- `api/prisma/seed.ts`: idempotent seed of 5 companies and 12 contacts.
- `api/tests/unit/companies.service.test.ts`, `contacts.service.test.ts`, `validation.test.ts` (new).
- `api/tests/integration/companies.test.ts`, `contacts.test.ts`, `http.ts` (new; `http.ts` is a typed `bodyOf` helper because supertest bodies are `any` and lint forbids unsafe access).

### Deviations from spec
- Added `toPaginated` to `shared/pagination.ts` so both services share the `{data, meta}` mapping instead of duplicating it.
- Added `tests/integration/http.ts` (not in spec) for lint-clean typed access to response bodies.
- Migration SQL was hand-written, as the spec allows; verified with `migrate dev` (no drift).

### Notes for tester/reviewer
- Pattern choices: services depend on repository interfaces (constructor injection), so unit tests use plain mocks. `ContactService` takes `CompanyRepository` for the 404 check on nested routes. Repositories turn Prisma P2025/P2003 into `null`/`false`, so races return 404 rather than 500, and the service owns the `NotFoundError`.
- Results: lint, typecheck clean; `npm test` 135 tests pass (unit and integration, test DB migrated). Seed run twice: 5 companies, 12 contacts, no duplicates.
- `migrate dev` and `seed` were run against the dev database (applies the migration, and the seed deletes all existing companies there).
- No new dependencies, no env changes.
- Suggested commit: `feat: add companies and contacts modules`.
