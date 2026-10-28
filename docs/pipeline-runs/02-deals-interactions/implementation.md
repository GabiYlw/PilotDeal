### Summary
Added the `Deal` and `Interaction` Prisma models (one migration, `20261028171613_add_deals_and_interactions`, generated with the migrate command) and the `deals` and `interactions` modules. They follow the companies/contacts layering: routes, controller, service, repository, with constructor injection wired in `container.ts`. `DealService` owns the `closedAt` rule. The seed now creates 8 deals and 26 interactions and stays idempotent. Unit and integration tests are included. No new dependencies, no env changes, no embedding column, no AI or scoring.

Lint, typecheck and all API tests pass (18 files, 466 tests). The seed was run twice and printed `5 companies, 12 contacts, 8 deals and 26 interactions` both times.

### Files changed
- `api/prisma/schema.prisma`: enums `DealStage`, `InteractionType`, models `Deal`, `Interaction`, `Company.deals` back-relation.
- `api/prisma/migrations/20261028171613_add_deals_and_interactions/migration.sql`: generated, not hand-edited. It has both enums, `DECIMAL(12,2)`, `DATE`, two `ON DELETE CASCADE` FKs, and no vector column.
- `api/src/shared/validation.ts`: `companyIdParamsSchema` moved here.
- `api/src/modules/contacts/contacts.schemas.ts`, `contacts.controller.ts`: use the shared `companyIdParamsSchema`. No behavior change.
- `api/src/modules/deals/deals.{schemas,repository,service,controller,routes}.ts` (new).
- `api/src/modules/interactions/interactions.{schemas,repository,service,controller,routes}.ts` (new).
- `api/src/container.ts`: wires the new repositories, services and controllers.
- `api/src/app.ts`: mounts the four routers (nested before parent prefixes).
- `api/prisma/seed.ts`: deals and interactions nested under each company, relative dates, count summary read from the DB.
- `api/tests/integration/http.ts`: `ApiItem` type and extra `ApiBody` fields.
- `api/tests/unit/deals.service.test.ts`, `interactions.service.test.ts`, `deals.schemas.test.ts`, `interactions.schemas.test.ts` (new).
- `api/tests/integration/deals.test.ts`, `interactions.test.ts`, `deals-race.test.ts` (new).

### Deviations from spec
- `prisma generate`: `npm --prefix api exec prisma generate` failed ("schema.prisma: file not found", because `exec` ran from the wrong directory). I ran `npx prisma generate` from `api/` instead. Same result.
- Seed value `48500.00` is written as the number `48500` (same value).
- Otherwise none.

### Notes for tester/reviewer
- Non-obvious decisions:
  - Decimal mapping: Prisma returns `value` as a `Decimal`, which JSON turns into a string. `toDeal` in the deal repository calls `.toNumber()`. DECIMAL(12,2) with max 9999999999.99 round-trips exactly through doubles. The repository returns the API-shaped domain `Deal`, so no Prisma type reaches services or controllers.
  - Date-only handling: `expectedCloseDate` is written as `new Date("YYYY-MM-DDT00:00:00.000Z")` and read back with `toISOString().slice(0, 10)`. Everything is in UTC, so a machine outside UTC cannot shift the day.
  - Decimal places are checked on `String(value)` with a regex, after the min/max checks. This rejects `0.1 + 0.2` and `1e-7`. The `max` check keeps Postgres from overflowing into a 500.
  - Why the `closedAt` rule reads the current deal: the new value depends on the previous stage (open to closed, closed to open, closed to the other closed stage, same stage). The service reads the deal only when `stage` is in the PATCH. Without `stage` there is no read and no `closedAt` key at all. A same-stage or open-to-open change also sends no `closedAt` key. The stage-change read-then-write is not locked, as accepted in the spec. If the deal vanishes between the read and the update, the repository maps P2025 to null and the result is 404.
  - Why `companyIdParamsSchema` moved to `shared/validation.ts`: so the deals module can use it without importing another module's schemas. Modules may depend on each other's repository interfaces, not on their schemas.
  - Strategy/DI: services depend on repository interfaces (`DealRepository`, `CompanyRepository`), so unit tests use mocks and the race tests subclass the Prisma repositories.
- Run: `docker compose up -d db`, then `npm --prefix api test`. The integration global setup applies the new migration to `dealpilot_test`.
- Seed data is relative to the run time (overdue and recent dates stay true whenever it is run). It writes `closedAt` directly for WON/LOST deals, because it bypasses DealService.
- Integration tests for the default `occurredAt` allow 2 s of skew because the default comes from the DB clock.
- A shell heredoc attempt failed early during implementation. Nothing was partially applied, and all files were written with the Write/Edit tools.
- Suggested commit: `feat: add deals and interactions modules`
