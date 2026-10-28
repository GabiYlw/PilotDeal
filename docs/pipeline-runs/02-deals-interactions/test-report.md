# Test report: deals and interactions

### Summary
- Framework: Vitest 5 (unit and integration projects) + Supertest, real Postgres test DB (`dealpilot_test`, via `DATABASE_URL_TEST`). No real Claude API or model download is involved.
- Commands run from the repo root: `npm --prefix api run lint`, `npm --prefix api run typecheck`, `npm --prefix api test`.
- Lint: clean. Typecheck: clean.
- `npm --prefix api test`: 19 files, 543 tests, all passed. Baseline before my additions was 18 files, 466 tests, all passed.
- Extra runs with a non-UTC process time zone (date-only round trip check): `TZ=America/Los_Angeles` and `TZ=Pacific/Kiritimati` on deals.test.ts, interactions.test.ts and my new file: 202/202 passed each.
- The one failure seen during development was a wrong assertion in my own new test (zod reports two issues for `value: -1`, I expected one). I fixed the test; it is not an application bug.
- Seed was NOT run (instructed not to touch the dev DB).

### Tests added
New file `api/tests/integration/deals-interactions-gaps.test.ts` (77 tests, DATABASE_URL_TEST only). The coder's existing tests already covered most ACs, so these fill gaps:
- closedAt transitions not covered over HTTP: LOST->WON moves forward; LOST->LOST unchanged (AC 12, req 34); LEAD->LOST closedAt within request window (AC 4/12); legacy WON row with null closedAt stays null on WON->WON and gets set on WON->LOST (edge case); stage + other fields patched together.
- Value decimals (AC 5, edge cases): round trip of 5, 5.1, 0.99, 1234567.89, 48500.5 through POST/GET/lists; raw JSON text contains `"value":48500.5` (number, not string); raw `5.10` stored as 5.1; raw `-0` stored as 0; raw `1e-7`, `1e10`, `0.001`, `9999999999.991`, `10000000000.00` return 400; PATCH max accepted / float noise rejected.
- Date-only expectedCloseDate (AC 3, 7, edge cases): exact round trip of 1900-01-01, 2000-02-29, 2026-12-31, 2026-01-01, 9999-12-31 via create/get/both lists; 400 for 1899-12-31, 2025-02-29, 0000-01-01, 2026-04-31, 2026-1-5, 20261231, empty string; set/change/clear via PATCH; DB column text equals the input date.
- Response shape (req 5/6, AC 25): exact key set for deal and interaction (no embedded relations), ISO createdAt/updatedAt, updatedAt advances on PATCH, validation `details` as `{path,message}` array.
- Validation order (req 26): params before body on POST deals and POST interactions, params before query.
- GET /deals filters (AC 9): each of six stages, stage+company with no match, filtered pagination with filtered total and past-end page, `?page=0`, `?pageSize=0`, `?page=abc`, `?page=-1` return 400, `pageSize=100` accepted; nested `?stage` ignored.
- Nil UUID returns 404 on nested routes (edge case).
- Cascades (AC 15/16, req 3): FK cascade through direct Prisma company delete; WON deal delete cascades interactions; FK rejects orphan inserts at DB level.
- Interactions (AC 17-23): occurredAt just before now accepted, a minute ahead rejected; future instant written with a +05:00 offset rejected; wall time that looks future but is past via offset accepted; 1900-01-01T00:00:00Z accepted and round-trips; >3 fractional digits truncated to ms; interactions allowed on WON/LOST deals; all four types accepted; ordering by occurredAt not createdAt; PATCH notes 5000 ok / 5001 rejected / trimmed; PATCH dealId rejected and dealId kept; 404 messages for list/PATCH/DELETE; no leakage across deals in list and total.

### Failures
None in the final run. (No application failures found.)

### Spec-coverage map
| AC | Status |
|----|--------|
| 1 migration | Covered & passing (deals.test.ts migration check; test DB applies it in global setup) |
| 2 create defaults | Covered & passing |
| 3 trim/number/date round trip | Covered & passing (also under non-UTC TZ) |
| 4 WON/LOST closedAt on create | Covered & passing |
| 5 value boundaries | Covered & passing |
| 6 POST 400/404 matrix | Covered & passing |
| 7 200-char title, leap day | Covered & passing |
| 8 company deals list | Covered & passing |
| 9 GET /deals + filters | Covered & passing |
| 10 GET /deals/:id | Covered & passing |
| 11 PATCH general | Covered & passing |
| 12 closedAt transitions | Covered & passing (all transitions incl. LOST->WON, LOST->LOST added) |
| 13 PATCH 400/404 | Covered & passing |
| 14 DELETE deal | Covered & passing |
| 15 company cascade | Covered & passing |
| 16 deal cascade | Covered & passing |
| 17 create interaction | Covered & passing |
| 18 occurredAt offsets | Covered & passing |
| 19 interaction POST 400/404 | Covered & passing |
| 20 interaction list | Covered & passing |
| 21 GET interaction | Covered & passing |
| 22 PATCH interaction | Covered & passing |
| 23 DELETE interaction | Covered & passing |
| 24 race paths | Covered & passing (coder's deals-race.test.ts) |
| 25 error shape | Covered & passing |
| 26 service unit tests | Covered & passing (coder's unit tests) |
| 27 lint/typecheck/tests | Passing |
| 28 seed (twice, counts, date properties) | Untested by me: not run because the instruction forbids seeding the dev DB, and no test exercises seed.ts against the test DB. The coder reports running it twice with matching counts; that is unverified here. |

### Regressions
None. All 466 previously passing tests still pass.
