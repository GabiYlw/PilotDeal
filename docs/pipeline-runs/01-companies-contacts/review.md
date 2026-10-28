> **Note:** Low findings 1 and 2 were fixed after this pipeline run, in the same
> commit (typed mocks in contacts.service.test.ts, and the new
> contacts-race.test.ts integration tests).

# Review: Companies and Contacts modules

### Summary
The change meets the spec closely. The `Company` and `Contact` models and the hand-written migration match the spec's expected SQL exactly, including the `ON DELETE CASCADE` FK and the two indexes. Both modules follow the required layering (routes -> controller -> service -> repository -> Prisma), use constructor injection, and are wired only in `container.ts`. Every handler validates params, then query, then body, through `parseOrThrow`. Repositories turn Prisma P2025 and P2003 errors into `null`/`false`, and services map those to `NotFoundError`. Routers are mounted in the order the spec gives. The tester reports lint and typecheck clean and 209 of 209 tests passing, with every acceptance criterion except the seed covered by automated tests. No Critical, High or Medium issues were found. The remaining findings are Low: test-typing consistency, an untested race path, and a seed that was only verified by the coder's own report.

### Findings

#### Critical
None

#### High
None

#### Medium
None

#### Low
1. `api/tests/unit/contacts.service.test.ts:19-37`: the mocks are bare `vi.fn()` objects with no link to the `ContactRepository` / `CompanyRepository` interfaces. Elsewhere, partial objects such as `{ id: companyId }` (lines 55, 81, 90) stand in for a `Company`. `companies.service.test.ts:7-15` types its mock against `keyof CompanyRepository`. Because of this, an interface change would not break the contacts unit tests at compile time. Fix: type the mocks the same way as `companies.service.test.ts` and use a full `Company` fixture.
2. `api/src/modules/contacts/contacts.repository.ts:36-45` and `api/src/shared/prisma-errors.ts:13-15`: the P2003 (FK violation) race path is only tested at the service level with mocked repos. Nothing checks against the real DB that `@prisma/adapter-pg` reports FK violations as `PrismaClientKnownRequestError` with code `P2003`. If the adapter reports them differently, the race would return 500 instead of 404. Fix (optional): add an integration test that calls `PrismaContactRepository.create` directly with a random `companyId` and expects `null`.
3. `api/prisma/seed.ts:71-90`: acceptance criterion 26 was not checked by the tester. The code is correct by inspection: `deleteMany` runs first, there are 5 companies with 2 or 3 nested contacts each, `$disconnect` runs in `finally`, and `exitCode = 1` is set on error. The coder reports running it twice with 5 companies and 12 contacts as the result. No change is required. The human should run `npm --prefix api run seed` twice before committing to confirm.
4. `api/tests/integration/http.ts:4-23`: `bodyOf` casts the response body to one combined "superset" type, so tests get no type safety on response shapes. This is acceptable as test-only code to satisfy the `no-unsafe-*` lint rules, and the implementation notes justify it. No change required.

### Spec adherence
- AC1 (schema, migration folder name and order, `migrate deploy`): met. `schema.prisma:14-38` and the migration SQL match the spec exactly. The global setup applies the migration, and the folder test passes.
- AC2-AC6 (POST /companies shape, trimming, 400 cases, 200-char name): met. `nameSchema`, `optionalText` and `websiteSchema` with the http/https protocol regex, plus `z.strictObject`, cover every case. Tests pass.
- AC7-AC10 (list, ordering, pagination bounds, page past end): met. Ordering is `createdAt desc, id desc`. The regex in `positiveIntString` rejects `0`, negatives, `1.5`, `abc`, empty and arrays. The 1,000,000 cap keeps `skip` within Int32.
- AC11-AC15 (GET/PATCH/DELETE company, 404/400, null clears, `{}` rejected): met.
- AC16 (cascade): met. The DB FK cascades, and it is tested through both the API and a Prisma count.
- AC17-AC19 (nested contact create/list, companyId from the URL, body companyId rejected, 404 without creating anything): met.
- AC20-AC22 (contact GET/PATCH/DELETE, companyId unchanged after a rejected PATCH, parent kept after delete): met.
- AC23 (error shape, details as `{ path, message }`): met. `toIssueDetails` produces it, and the existing middleware is unchanged.
- AC24 (service unit tests with mocked repos): met.
- AC25 (lint, typecheck, test:unit, test:integration): met per the test report. Both projects ran inside `npm test` with 209 of 209 passing.
- AC26 (seed is idempotent, 5 companies with 2 or 3 contacts): met by code inspection and the coder's own run. The tester did not verify it independently (see Low 3).
- Conventions: layering, DI in `container.ts`, `.js` ESM imports, `import type`, no `any`, arrow-function handlers, typed errors, and plural nouns with 201/204/404 are all followed. No new dependencies and no env changes. The `.gitignore` change adds `generated/`, the Prisma client output, which is appropriate. The deviations (`toPaginated`, `tests/integration/http.ts`) are small and justified.
- Security: no raw SQL was added to production code. All input is validated with zod strict objects. The website field allows only http/https, which blocks `javascript:` URLs. No secrets are handled.

### Verdict
The change is correct, complete against the spec, secure, and follows the project conventions. There are no open test failures and no unmet acceptance criteria. The only findings are Low and do not block the merge.

STATUS: PASS
