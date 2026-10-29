# Test report: rule-based deal priority scoring

### Summary
- Framework: Vitest (unit + integration projects), Supertest, real Postgres test DB (`dealpilot_test`, db container healthy).
- Commands: `npm run lint`, `npm run typecheck`, `npm test` (all in `api/`).
- Result: lint clean, typecheck clean, 21 test files, 632 tests, 632 passed, 0 failed. Before this work the suite had 543 tests (per implementation.md), so 89 tests were added.
- No bugs found in the source code.

### Tests added
- `api/tests/unit/rule-based-scorer.test.ts` (new): stage table (AC1); days-since-contact table 3/4/7/8/14/15/21/22 (AC2); createdAt fallback table (AC3); unsorted interactions (AC4); future interaction/createdAt (AC5); calendar-day case 23:59 vs 00:01 (AC6); close date table -1/0/+7/+8/+30/+31, null, 1900-01-01 (AC7); value table 0/4999.99/5000/19999.99/20000/49999.99/50000 (AC8); min 10 / max 100 / sum (AC9); factor order, names, scoredBy, omitted zero-point rules (AC10); reason cases (AC11-15 incl. three ties and "is in 0 days", value 0 lead case); value formatting table 48500.5/50000/1234567.89/100/4999.99 (AC16); nextAction rules, priority order, null and today close dates, stage table (AC17-21); fake system time far away plus `now` called exactly once (AC22).
- `api/tests/unit/deals.service.test.ts` (extended): `listPrioritized` (sort with all three tie-breaks, pagination and total, context passed to the scorer, empty, closed candidate skipped) (AC23); `getNextAction` (404 without scoring, 409 DEAL_CLOSED table for WON/LOST without scoring, success returns `{dealId, ...result}`) (AC24). Helper `setup()` now also returns the mocked scorer.
- `api/tests/integration/deals-priority.test.ts` (new): fixed clock via `createContainer(config, { clock })`, explicit `createdAt`/`occurredAt` in all fixtures, hand-computed scores in comments. Ordering with score/date/null/id ties and shuffled insert order (AC25); WON/LOST excluded from data and total (AC26); pagination slices, page past the end, 400 table for pageSize=101/page=0/pageSize=abc (AC27); item shape and exact deal keys, numeric value (AC28); 6 interactions with newest inserted first (AC29); empty database 200 (AC30); next-action exact payload and company name in the follow-up (AC31); next-action 404, 409 for WON/LOST, 400 for non-UUID (AC32).
- `api/tests/integration/http.ts`: added `ApiPriority`, `companyName`, `deal`, `priority`, `score`, `reason`, `nextAction`, `factors`, `scoredBy` to the superset types.

### Failures
None in the final run. During authoring, three failures were in my own test (capitalised sentence start in the value-format assertion) and one lint error (`no-misused-promises` in a test helper); both were fixed in the tests.

### Spec-coverage map
| AC | Status |
|----|--------|
| 1-22 | Covered & passing (unit, `rule-based-scorer.test.ts`) |
| 23-24 | Covered & passing (unit, `deals.service.test.ts`) |
| 25-32 | Covered & passing (integration, `deals-priority.test.ts`) |
| 33 | Covered & passing: lint, typecheck and the full suite pass; existing tests unchanged apart from the coder's mechanical updates |

Not directly tested (no AC requires it): the "one query, no N+1" requirement (req. 27) and the "only `clock.ts` calls `new Date()`" rule; these were not asserted by any test.

### Regressions
None. All previously existing tests still pass.
