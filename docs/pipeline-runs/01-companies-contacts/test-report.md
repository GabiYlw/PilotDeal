### Summary
- Framework: Vitest 5.0.5 plus Supertest (unit and integration projects), test DB `dealpilot_test` via `DATABASE_URL_TEST`. The dev DB was not touched.
- Commands run from `api/`: `npm run lint`, `npm run typecheck`, `npm test`.
- Result: lint clean, typecheck clean, 10 test files, 209 tests, 209 passed, 0 failed.
- Baseline before my additions (coder's tests): 9 files, 135 tests, all passing.
- No source code was changed. No real Claude API or model downloads are involved.
- One of my new tests initially failed because of a bug in the test itself (the "321 character email" was really 317 characters). I fixed the test and re-ran. It was not an application bug.

### Tests added
New file: `api/tests/integration/validation-edge-cases.test.ts` (74 tests, supplementing the coder's existing companies/contacts/unit tests).
- Migration folder: exactly one `*_add_companies_and_contacts`, sorts after `20261028000000_enable_pgvector`, SQL contains `ON DELETE CASCADE`. Tables exist in the migrated test DB (criterion 1, requirement 4).
- Pagination: `pageSize` of 0, 101, abc, empty, -5, 1.5 and repeated key give 400. `page=1000000` is accepted. Defaults are 1 and 20 (criteria 9, 10).
- Malformed UUIDs (wrong-character, short, nil-with-one-digit-missing) return 400 on all 8 id routes. Nil UUID on a contact returns 404 (requirement 26, edge cases).
- Validation order: params before body, query before lookup, body before company lookup (requirement 31).
- Error shape: the body has only `error`, `details` entries are `{path, message}`, and the exact NOT_FOUND messages for company and contact (criterion 23, requirements 32 to 34).
- Company body: whitespace/empty/over-length industry, 2049-char website, `javascript:` website, `id` and `updatedAt` keys, string and number bodies. PATCH with null name, protected keys, unknown keys, non-object bodies and `{}` (criteria 5, 14, requirements 18 to 25). Explicit nulls on POST. No row is created on a failed POST.
- Contact body: 200/201-char name, null name, whitespace phone and role, 51-char phone, 101-char role, 321-char email, email with whitespace, `id` and `createdAt` keys. Nothing is created on failure. Contact PATCH with protected or unknown keys, no body, malformed JSON. PATCH on a missing contact does not upsert (criteria 18, 21).
- Contact list: `id DESC` tiebreak on equal `createdAt`, page past the end, bad pagination, unknown query ignored (criterion 19, requirements 35 to 37).
- Cascade: deleting one company keeps another company's contacts and returns a 204 with an empty body (criterion 16).

Existing tests by the coder (reviewed, run, all passing): `tests/unit/companies.service.test.ts`, `contacts.service.test.ts`, `validation.test.ts`, `tests/integration/companies.test.ts`, `contacts.test.ts`.

### Failures
None in the final run.

### Spec-coverage map
| # | Criterion | Status |
|---|-----------|--------|
| 1 | Schema, migration folder, `migrate deploy` clean | Covered & passing (global setup applies migrations; folder test) |
| 2 | POST name only returns 201 shape | Covered & passing |
| 3 | POST all fields | Covered & passing |
| 4 | POST trims name | Covered & passing |
| 5 | POST 400 cases | Covered & passing |
| 6 | 200-char name | Covered & passing |
| 7 | Empty list | Covered & passing |
| 8 | Order and page 2 | Covered & passing |
| 9 | Bad pagination 400 | Covered & passing |
| 10 | pageSize=100, page past end | Covered & passing |
| 11 | GET company 200/404/400 | Covered & passing |
| 12 | PATCH partial, updatedAt monotonic | Covered & passing |
| 13 | PATCH website null | Covered & passing |
| 14 | PATCH 400/404 cases | Covered & passing |
| 15 | DELETE company | Covered & passing |
| 16 | Cascade | Covered & passing |
| 17 | POST contact | Covered & passing |
| 18 | POST contact 400/404 | Covered & passing |
| 19 | List contacts | Covered & passing |
| 20 | GET contact | Covered & passing |
| 21 | PATCH contact | Covered & passing |
| 22 | DELETE contact | Covered & passing |
| 23 | Error shape | Covered & passing |
| 24 | Service unit tests with mocks | Covered & passing |
| 25 | lint, typecheck, test:unit, test:integration | Passing (lint, typecheck and the combined `npm test` run were observed; `test:unit` and `test:integration` were not run separately, but both projects ran inside `npm test`) |
| 26 | Seed leaves 5 companies with 2 or 3 contacts, idempotent | Not independently verified. The seed deletes all companies in the dev DB, and I was told not to touch it. No test runs it. The coder reports running it twice (5 companies, 12 contacts). |

Gap note: the P2025/P2003 race paths in the Prisma repositories are covered only at the service level (mocked repos returning null/false). They are not exercised against a real DB race.

### Regressions
None. All 135 previously passing tests still pass.
